// Generated by CoffeeScript 1.9.1
var Break, FETCH_AT_ONCE, Mailbox, Message, NotFound, TestMailbox, _, async, cozydb, log, mailutils, ramStore, ref, safeLoop,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty,
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
  bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

cozydb = require('cozydb');

safeLoop = require('../utils/safeloop');

Mailbox = (function(superClass) {
  extend(Mailbox, superClass);

  function Mailbox() {
    return Mailbox.__super__.constructor.apply(this, arguments);
  }

  Mailbox.docType = 'Mailbox';

  Mailbox.schema = {
    accountID: String,
    label: String,
    path: String,
    lastSync: String,
    tree: [String],
    delimiter: String,
    uidvalidity: Number,
    attribs: [String],
    lastHighestModSeq: String,
    lastTotal: Number
  };

  Mailbox.RFC6154 = {
    draftMailbox: '\\Drafts',
    sentMailbox: '\\Sent',
    trashMailbox: '\\Trash',
    allMailbox: '\\All',
    junkMailbox: '\\Junk',
    flaggedMailbox: '\\Flagged'
  };

  Mailbox.prototype.isSelectable = function() {
    return indexOf.call(this.attribs || [], '\\Noselect') < 0;
  };

  Mailbox.prototype.RFC6154use = function() {
    var attribute, field, ref;
    if (this.path === 'INBOX') {
      return 'inboxMailbox';
    }
    ref = Mailbox.RFC6154;
    for (field in ref) {
      attribute = ref[field];
      if (indexOf.call(this.attribs, attribute) >= 0) {
        return field;
      }
    }
  };

  Mailbox.prototype.guessUse = function() {
    var path;
    path = this.path.toLowerCase();
    if (/sent/i.test(path)) {
      return 'sentMailbox';
    } else if (/draft/i.test(path)) {
      return 'draftMailbox';
    } else if (/flagged/i.test(path)) {
      return 'flaggedMailbox';
    } else if (/trash/i.test(path)) {
      return 'trashMailbox';
    }
  };

  Mailbox.scanBoxesForSpecialUse = function(boxes) {
    var box, boxAttributes, changes, i, len, removeGuesses, type, useRFC6154;
    useRFC6154 = false;
    boxAttributes = Object.keys(Mailbox.RFC6154);
    changes = {
      initialized: true
    };
    removeGuesses = function() {
      var attribute, i, len, results;
      if (!useRFC6154) {
        useRFC6154 = true;
        results = [];
        for (i = 0, len = boxAttributes.length; i < len; i++) {
          attribute = boxAttributes[i];
          if (attribute !== 'inboxMailbox') {
            results.push(changes[attribute] = void 0);
          } else {
            results.push(void 0);
          }
        }
        return results;
      }
    };
    for (i = 0, len = boxes.length; i < len; i++) {
      box = boxes[i];
      type = box.RFC6154use();
      if (type) {
        if (type !== 'inboxMailbox') {
          removeGuesses();
        }
        log.debug('found', type);
        changes[type] = box.id;
      } else if (!useRFC6154) {
        type = box.guessUse();
        if (type) {
          log.debug('found', type, 'guess');
          changes[type] = box.id;
        }
      }
    }
    changes.favorites = Mailbox.pickFavorites(boxes, changes);
    return changes;
  };

  Mailbox.pickFavorites = function(boxes, changes) {
    var box, favorites, i, id, j, len, len1, priorities, ref, type;
    favorites = [];
    priorities = ['inboxMailbox', 'allMailbox', 'sentMailbox', 'draftMailbox'];
    for (i = 0, len = priorities.length; i < len; i++) {
      type = priorities[i];
      id = changes[type];
      if (id) {
        favorites.push(id);
      }
    }
    for (j = 0, len1 = boxes.length; j < len1; j++) {
      box = boxes[j];
      if (favorites.length < 4) {
        if ((ref = box.id, indexOf.call(favorites, ref) < 0) && box.isSelectable()) {
          favorites.push(box.id);
        }
      }
    }
    return favorites;
  };

  Mailbox.prototype.doASAP = function(operation, callback) {
    return ramStore.getImapPool(this).doASAP(operation, callback);
  };

  Mailbox.prototype.doASAPWithBox = function(operation, callback) {
    return ramStore.getImapPool(this).doASAPWithBox(this, operation, callback);
  };

  Mailbox.prototype.doLaterWithBox = function(operation, callback) {
    return ramStore.getImapPool(this).doLaterWithBox(this, operation, callback);
  };

  Mailbox.prototype.imapcozy_rename = function(newLabel, newPath, callback) {
    log.debug("imapcozy_rename", newLabel, newPath);
    return this.doASAP((function(_this) {
      return function(imap, cbRelease) {
        return imap.renameBox2(_this.path, newPath, cbRelease);
      };
    })(this), (function(_this) {
      return function(err) {
        log.debug("imapcozy_rename err", err);
        if (err) {
          return callback(err);
        }
        return _this.renameWithChildren(newLabel, newPath, function(err) {
          if (err) {
            return callback(err);
          }
          return callback(null);
        });
      };
    })(this));
  };

  Mailbox.prototype.imapcozy_delete = function(callback) {
    var account;
    log.debug("imapcozy_delete");
    account = ramStore.getAccount(this.accountID);
    return async.series([
      (function(_this) {
        return function(cb) {
          log.debug("imap_delete");
          return _this.doASAP(function(imap, cbRelease) {
            return imap.delBox2(_this.path, cbRelease);
          }, cb);
        };
      })(this), (function(_this) {
        return function(cb) {
          log.debug("account.forget");
          account = ramStore.getAccount(_this.accountID);
          return account.forgetBox(_this.id, cb);
        };
      })(this), (function(_this) {
        return function(cb) {
          var boxes;
          boxes = ramStore.getSelfAndChildrenOf(_this);
          return safeLoop(boxes, function(box, next) {
            return box.destroy(next);
          }, function(errors) {
            return cb(errors[0]);
          });
        };
      })(this)
    ], function(err) {
      return callback(err);
    });
  };

  Mailbox.prototype.renameWithChildren = function(newLabel, newPath, callback) {
    var boxes, depth, path;
    log.debug("renameWithChildren", newLabel, newPath, this.path);
    depth = this.tree.length - 1;
    path = this.path;
    boxes = ramStore.getSelfAndChildrenOf(this);
    log.debug("imapcozy_rename#boxes", boxes.length, depth);
    return async.eachSeries(boxes, function(box, cb) {
      var changes, item;
      log.debug("imapcozy_rename#box", box);
      changes = {};
      changes.path = box.path.replace(path, newPath);
      changes.tree = (function() {
        var i, len, ref, results;
        ref = box.tree;
        results = [];
        for (i = 0, len = ref.length; i < len; i++) {
          item = ref[i];
          results.push(item);
        }
        return results;
      })();
      changes.tree[depth] = newLabel;
      if (box.tree.length === depth + 1) {
        changes.label = newLabel;
      }
      return box.updateAttributes(changes, cb);
    }, callback);
  };

  Mailbox.prototype.imap_createMailNoDuplicate = function(account, message, callback) {
    var messageID;
    messageID = message.headers['message-id'];
    return this.doLaterWithBox(function(imap, imapbox, cb) {
      return imap.search([['HEADER', 'MESSAGE-ID', messageID]], cb);
    }, (function(_this) {
      return function(err, uids) {
        if (err) {
          return callback(err);
        }
        if (uids != null ? uids[0] : void 0) {
          return callback(null, uids != null ? uids[0] : void 0);
        }
        return account.imap_createMail(_this, message, callback);
      };
    })(this));
  };

  Mailbox.prototype.imap_removeMail = function(uid, callback) {
    return this.doASAPWithBox(function(imap, imapbox, cbRelease) {
      return async.series([
        function(cb) {
          return imap.addFlags(uid, '\\Deleted', cb);
        }, function(cb) {
          return imap.expunge(uid, cb);
        }, function(cb) {
          return imap.closeBox(cb);
        }
      ], cbRelease);
    }, callback);
  };

  Mailbox.prototype.imap_expungeMails = function(callback) {
    var box;
    box = this;
    return this.doASAPWithBox(function(imap, imapbox, cbRelease) {
      return imap.fetchBoxMessageUIDs(function(err, uids) {
        if (err) {
          return cbRelease(err);
        }
        if (uids.length === 0) {
          return cbRelease(null);
        }
        return async.series([
          function(cb) {
            return imap.addFlags(uids, '\\Deleted', cb);
          }, function(cb) {
            return imap.expunge(uids, cb);
          }, function(cb) {
            return imap.closeBox(cb);
          }, function(cb) {
            return Message.safeRemoveAllFromBox(box.id, function(err) {
              if (err) {
                log.error("fail to remove msg of box " + box.id, err);
              }
              return cb();
            });
          }
        ], cbRelease);
      });
    }, callback);
  };

  Mailbox.prototype.ignoreInCount = function() {
    var ref, ref1, ref2;
    return (ref = Mailbox.RFC6154.trashMailbox, indexOf.call(this.attribs, ref) >= 0) || (ref1 = Mailbox.RFC6154.junkMailbox, indexOf.call(this.attribs, ref1) >= 0) || ((ref2 = this.guessUse()) === 'trashMailbox' || ref2 === 'junkMailbox');
  };

  return Mailbox;

})(cozydb.CozyModel);

TestMailbox = (function(superClass) {
  extend(TestMailbox, superClass);

  function TestMailbox() {
    this.imap_expungeMails = bind(this.imap_expungeMails, this);
    return TestMailbox.__super__.constructor.apply(this, arguments);
  }

  TestMailbox.prototype.imap_expungeMails = function(callback) {
    return Message.safeRemoveAllFromBox(this.id, callback);
  };

  return TestMailbox;

})(Mailbox);

module.exports = Mailbox;

require('./model-events').wrapModel(Mailbox);

ramStore = require('./store_account_and_boxes');

Message = require('./message');

log = require('../utils/logging')({
  prefix: 'models:mailbox'
});

_ = require('lodash');

async = require('async');

mailutils = require('../utils/jwz_tools');

ref = require('../utils/errors'), Break = ref.Break, NotFound = ref.NotFound;

FETCH_AT_ONCE = require('../utils/constants').FETCH_AT_ONCE;
