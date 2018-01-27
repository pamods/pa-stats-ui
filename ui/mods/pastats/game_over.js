var paStatsLoaded;

function paStats()
{

    if ( paStatsLoaded )
    {
        return;
    }

    loadScript( "coui://ui/mods/pastats/global.js" );

    paStatsLoaded = true;

// usually the game should be unlocked here already, this call is just here to make sure it really is unlocked

    paStatsGlobal.unlockGame();

    checkPaStatsVersion();

    model.paStatsGameId = ko.observable(undefined);
    model.hasPaStatsGame = ko.computed(function() {
        return model.paStatsGameId() !== undefined;
    });

    model.openPaStatsGame = function() {
        engine.call('web.launchPage', 'http://pastats.com/chart?gameId=' + model.paStatsGameId());
    };

    var queryGameId = function() {
        $.getJSON(paStatsGlobal.queryUrlBase + "report/gameIdFor?gameIdent="+decode(localStorage.pa_stats_lobbyId), function(gameId) {
            console.log("pa stats game id is "+gameId);
            model.paStatsGameId(gameId);
        });
    };

    $('.div_stats_panel_options').prepend('<!-- ko if: model.hasPaStatsGame --><div><input style="background-image: url(http://pastats.com/mod/icon.png); background-repeat: no-repeat; padding-right: 85px; background-position: 150px 2px; background-size: 50px 50px" type="button" value="Details on" id="pa_stats_btt" class="" data-bind="click: openPaStatsGame, click_sound: \'default\', rollover_sound: \'default\'" /></div><!-- /ko -->');

    if (decode(localStorage[paStatsGlobal.wantsToSendKey])) {

        function wasVsAiGame(msg) {
            var armies = msg.data.armies;
            var humanArmyCnt = 0;
            for (var i = 0; i < armies.length; i++) {
                if (!armies[i].ai) {
                    humanArmyCnt++;
                }
            }
            return humanArmyCnt <= 1;
        }

        function getWinnerTeamIndex(msg) {
            var armies = msg.data.armies;
            var armiesAlive = 0;
            console.log(armies);
            for (var i = 0; i < armies.length; i++) {
                if (!armies[i].defeated) {
                    armiesAlive++;
                }
            }
            var winnerIndex = -2;
            if (armiesAlive > 1 || wasVsAiGame(msg)) {
                winnerIndex = -2;
            } else if (armiesAlive == 0) {
                winnerIndex = -1; // all dead => draw
            } else {
                for (var i = 0; i < armies.length; i++) {
                    if (!armies[i].defeated) {
                        return i;
                    }
                }
                winnerIndex = -2; // this should never really happen...
            }
            return winnerIndex;
        }

        var oldGameOverHandler = handlers.server_state;
        handlers.server_state = function(payload) {
            if (payload && payload.data) {
                if (!payload.state.endsWith('game_over')) {
                    return;
                }

                queryGameId();

                var winnerTeam = getWinnerTeamIndex(payload)

                var gameOverMsg = payload.data.game_over;
                var gameOverText = "";
                if (winnerTeam != -1 && gameOverMsg && gameOverMsg.victor_name) {
                    var numWinners = gameOverMsg.victor_players.length;
                    if (numWinners) {
                        gameOverText += gameOverMsg.victor_players.join(", ");
                    } else { //ai victory
                        gameOverText += gameOverMsg.victor_name;
                    }
                } else {
                    // causes the original handler to show "DRAW"
                    delete payload.data.game_over.victor_name
                    gameOverText = "DRAW";
                }

                $.ajax({
                    type : "PUT",
                    url : paStatsGlobal.queryUrlBase + "report/winner",
                    contentType : "application/json",
                    data : JSON.stringify({
                        gameLink : decode(localStorage['pa_stats_game_link']),
                        victor : gameOverText,
                        teamIndex: winnerTeam
                    }),
                    complete : function(r) {
                        oldGameOverHandler(payload);
                    }
                });
            } else {
                oldGameOverHandler(payload);
            }
        };
    }

}

try
{
    paStats();
}
catch (e)
{
    console.log( e.stack || e );
}
