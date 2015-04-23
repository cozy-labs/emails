Store = require '../libs/flux/store/store'

{ActionTypes, Dispositions} = require '../constants/app_constants'

class LayoutStore extends Store

    ###
        Initialization.
        Defines private variables here.
    ###
    _disposition =
        type   : Dispositions.VERTICAL
        height : 5
        width  : 6
    _alert =
        level: null
        message: null

    _tasks = Immutable.OrderedMap()

    _shown = true

    _intentAvailable = false

    _drawer = false


    ###
        Defines here the action handlers.
    ###
    __bindHandlers: (handle) ->

        handle ActionTypes.SET_DISPOSITION, (disposition) ->
            if disposition.disposition?
                _disposition = disposition.disposition
            else
                _disposition.type = disposition.type
                if _disposition.type is Dispositions.VERTICAL
                    if not disposition.value?
                        disposition.value = _disposition.width
                    _disposition.height = 5
                    _disposition.width  = disposition.value
                else if _disposition.type is Dispositions.HORIZONTAL
                    if not disposition.value?
                        disposition.value = _disposition.height
                    _disposition.height = disposition.value
                    _disposition.width  = 6
                else if _disposition.type is Dispositions.THREE
                    if not disposition.value?
                        disposition.value = _disposition.width
                    _disposition.height = 5
                    _disposition.width  = disposition.value
            @emit 'change'

        handle ActionTypes.DISPLAY_ALERT, (value) ->
            _alert.level   = value.level
            _alert.message = value.message
            @emit 'change'

        handle ActionTypes.HIDE_ALERT, (value) ->
            _alert.level   = null
            _alert.message = null
            @emit 'change'

        # Hide alerts on mailbox / account change
        handle ActionTypes.SELECT_ACCOUNT, (value) ->
            _alert.level   = null
            _alert.message = null
            @emit 'change'

        handle ActionTypes.REFRESH, ->
            @emit 'change'

        handle ActionTypes.CLEAR_TOASTS, ->
            _tasks = Immutable.OrderedMap()
            @emit 'change'

        handle ActionTypes.RECEIVE_TASK_UPDATE, (task) =>
            task = Immutable.Map task
            id = task.get 'id'
            _tasks = _tasks.set id, task
            if task.get 'autoclose'
                remove = =>
                    _tasks = _tasks.remove id
                    @emit 'change'
                setTimeout remove, 5000
            @emit 'change'

        handle ActionTypes.RECEIVE_TASK_DELETE, (taskid) ->
            _tasks = _tasks.remove taskid
            @emit 'change'

        handle ActionTypes.TOASTS_SHOW, ->
            _shown = true
            @emit 'change'

        handle ActionTypes.TOASTS_HIDE, ->
            _shown = false
            @emit 'change'

        handle ActionTypes.INTENT_AVAILABLE, (avaibility) ->
            _intentAvailable = avaibility
            @emit 'change'

        handle ActionTypes.DRAWER_SHOW, ->
            return if _drawer is true
            _drawer = true
            @emit 'change'

        handle ActionTypes.DRAWER_HIDE, ->
            return if _drawer is false
            _drawer = false
            @emit 'change'

        handle ActionTypes.DRAWER_TOGGLE, ->
            _drawer = not _drawer
            @emit 'change'


    ###
        Public API
    ###
    getDisposition: -> return _disposition

    getAlert: -> return _alert

    getToasts: -> return _tasks

    isShown: -> return _shown

    intentAvailable: -> return _intentAvailable

    isDrawerExpanded: -> return _drawer

module.exports = new LayoutStore()
