// Generated by CoffeeScript 1.9.1
var Message, Process, RecoverChangedUIDValidity, async, log, mailutils, safeLoop,
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

Process = require('./_base');

safeLoop = require('../utils/safeloop');

async = require('async');

log = require('../utils/logging')('process:recover-uidvalidity');

mailutils = require('../utils/jwz_tools');

Message = require('../models/message');

module.exports = RecoverChangedUIDValidity = (function(superClass) {
  extend(RecoverChangedUIDValidity, superClass);

  function RecoverChangedUIDValidity() {
    this.storeNewUIDValidty = bind(this.storeNewUIDValidty, this);
    this.fixOneMessageUID = bind(this.fixOneMessageUID, this);
    this.fixMessagesUIDs = bind(this.fixMessagesUIDs, this);
    this.fetchAllImapMessageIDs = bind(this.fetchAllImapMessageIDs, this);
    return RecoverChangedUIDValidity.__super__.constructor.apply(this, arguments);
  }

  RecoverChangedUIDValidity.prototype.code = 'recover-uidvalidity';

  RecoverChangedUIDValidity.prototype.initialize = function(options, callback) {
    this.mailbox = options.mailbox;
    this.newUidvalidity = options.newUidvalidity;
    this.imap = options.imap;
    this.done = 0;
    this.total = 1;
    return async.series([
      (function(_this) {
        return function(cb) {
          return _this.imap.openBox(_this.mailbox.path, cb);
        };
      })(this), this.fetchAllImapMessageIDs, this.fixMessagesUIDs, this.storeNewUIDValidty
    ], callback);
  };

  RecoverChangedUIDValidity.prototype.getProgress = function() {
    return this.done / this.total;
  };

  RecoverChangedUIDValidity.prototype.fetchAllImapMessageIDs = function(callback) {
    return this.imap.fetchBoxMessageIDs((function(_this) {
      return function(err, messages) {
        if (err) {
          return callback(err);
        }
        _this.messages = messages;
        _this.uids = Object.keys(messages);
        _this.total = _this.uids.length;
        return callback(null);
      };
    })(this));
  };

  RecoverChangedUIDValidity.prototype.fixMessagesUIDs = function(callback) {
    return safeLoop(this.uids, (function(_this) {
      return function(newUID, cb) {
        var messageID;
        messageID = mailutils.normalizeMessageID(_this.messages[newUID]);
        return _this.fixOneMessageUID(messageID, newUID, cb);
      };
    })(this), function(errors) {
      var err, i, len;
      for (i = 0, len = errors.length; i < len; i++) {
        err = errors[i];
        log.error(err);
      }
      return callback(errors[0]);
    });
  };

  RecoverChangedUIDValidity.prototype.fixOneMessageUID = function(messageID, newUID, callback) {
    log.debug("recoverChangedUID");
    this.done += 1;
    return Message.byMessageID(this.mailbox.accountID, messageID, (function(_this) {
      return function(err, message) {
        var mailboxIDs;
        if (err) {
          return callback(err);
        }
        if (!message) {
          return callback(null);
        }
        if (!message.mailboxIDs[_this.mailbox.id]) {
          return callback(null);
        }
        mailboxIDs = message.cloneMailboxIDs();
        mailboxIDs[_this.mailbox.id] = newUID;
        return message.updateAttributes({
          mailboxIDs: mailboxIDs
        }, callback);
      };
    })(this));
  };

  RecoverChangedUIDValidity.prototype.storeNewUIDValidty = function(callback) {
    var changes;
    changes = {
      uidvalidity: this.newUidvalidity
    };
    return this.mailbox.updateAttributes(changes, callback);
  };

  return RecoverChangedUIDValidity;

})(Process);
