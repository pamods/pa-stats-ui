// at least one other mod uses the existence of this value in the global namespace as a check if PA Stats is loaded
// => do not remove
function checkPaStatsVersion() {
    $.get(paStatsGlobal.queryUrlBase + "report/version", function(v) {
        localStorage['pa_stats_req_version'] = v.version;
    });
}

var paStatsGlobal = (function() {
    //check if we are currently in development mode and determine correct URL to use
    var _queryUrlBase = 'http://pastats.com/';

    var _reportVersion = 20;

    var _pollingSpeed = 3000;

    function _unlockGame(finalCall) {
        var link = decode(localStorage['pa_stats_game_link']);
        if (link !== undefined) {
            $.ajax({
                type : "GET",
                url : _queryUrlBase + "report/unlock?link=" + decode(link),
                complete : function(r) {
                    if (finalCall) {
                        finalCall();
                    }
                }
            });
        } else {
            if (finalCall) {
                finalCall();
            }
        }
    }

    var nanodesu = "info.nanodesu.pastats.";
    var _wantsToSendKey = 'pa_stats_wants_to_send_';
    var _showDataLiveKey = "pa_stats_show_data_live";
    var _isRankedGame = nanodesu + "isRanked";
    var _autoPause = nanodesu + "autopauseenabled";

    // make sure the defaults are set
    if (localStorage[_wantsToSendKey] === undefined) {
        localStorage[_wantsToSendKey] = encode(true);
        localStorage[_showDataLiveKey] = encode(true);
    }

    if (localStorage[_autoPause] === undefined) {
        localStorage[_autoPause] = encode(true);
    }

    return {
        wantsToAutopause: _autoPause,
        pa_stats_session_teams : nanodesu + "teams",
        pa_stats_session_team_index : nanodesu + "team_index",
        pa_stats_stored_version : nanodesu + "version",
        pa_stats_replay_started_in_session: nanodesu + "replaystarted",
        lastConfirmedRankedLobby: nanodesu + "lastConfirmedRankedLobby",
        isLocalGame: nanodesu + "isLocalGame",
        vetoMapName: nanodesu + "vetoMap",
        wantsToSendKey : _wantsToSendKey,
        showDataLiveKey : _showDataLiveKey,
        isRankedGameKey: _isRankedGame,
        unlockGame: _unlockGame,
        reportVersion: _reportVersion,
        queryUrlBase: _queryUrlBase,
        pollingSpeed: _pollingSpeed,
    };
}());
