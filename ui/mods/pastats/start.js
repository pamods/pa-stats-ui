var paStatsLoaded;

function paStats()
{

    if ( paStatsLoaded )
    {
        return;
    }

    loadScript( "coui://ui/mods/pastats/global.js" );

    paStatsLoaded = true;

    localStorage['pa_stats_is_ranked'] = encode(false);

    if (sessionStorage[paStatsGlobal.pa_stats_replay_started_in_session] == undefined) {
        sessionStorage[paStatsGlobal.pa_stats_replay_started_in_session] = "true";

        api.game.getSetupInfo().then(function(payload) {
            console.log("getSetupInfo");
            console.log(payload);

            // support both startpa:// formats, prefer the newer one
            var custData = payload.ui_options || payload.username;
            if (custData && custData.indexOf("startpa://") === 0) {
                custData = custData.replace("startpa://", "").replace("/", "");
                if (custData.indexOf("replay=") === 0) {
                    var replayToStart = custData.substring("replay=".length, custData.length);
                    replayToStart = 'coui://ui/main/game/connect_to_game/connect_to_game.html?action=start&content=PAExpansion1&replayid=' + replayToStart;
                    console.log("was asked to launch a replay, will do so after login for replay "+replayToStart);

                    var startPoll = function() {
                        if (model.signedInToUbernet()) {
                            setTimeout(function() {
                                console.log("will switch now to start replay @ "+replayToStart);
                                window.location.href = replayToStart;
                            }, 500);
                        } else {
                            setTimeout(startPoll, 500);
                        }
                    };
                    setTimeout(startPoll);
                }
            }
        });
    }

    checkPaStatsVersion();

    function showInfoMessage() {
        var lastVersion = localStorage[paStatsGlobal.pa_stats_stored_version];

        var htmlMsg = '<div id="pa_stats_welcome" title="" style="visibility:hidden">' +
        '<div style="font-size: 2em; font-weight: bold;">' +
            'Welcome to PA Stats' +
        '</div>' +
        '<div>Your PA Stats Version was automatically updated to the latest version.</div><br/>' +
        '<br/><div>Visit www.pastats.com/updates for the most recent full Changelog.</div>' +
        '<div style="margin: 10px 0px;">' +
            'By clicking <b>Accept</b> below, you acknowledge that you have read and agree to the '+
            'following conditions.'+
        '</div>'+
        '<div id="div_eula_cont" style="height: auto; width: 550px; border: 1px solid #333;'+
            'overflow: auto; padding: 10px;">'+
            '<p>If you should notice possible bugs in the UI, especially after patches, please try to disable PA Stats and any other UI-mod before reporting any bugs to Uber. Just to make sure Uber is not given bugreports, just because a new patch broke PA Stats. Report such bugs to me instead, I will always try to fix up PA Stats after patches as fast as possible and often PA Stats just keeps working :)</p>'+
            '<p>By using PA Stats you agree that arbitrary data on your gameplay will be gathered, processed and published on www.pastats.com so you and anyone else can analyze it.</p>'+
            '<p>Data however will only be processed in the interest of gameplay-analysis. No profit will be made with any data gathered.</p>'+
            '<p>If you disagree please either uncheck "Send Data to PA Stats" ingame, which prevents any data from being sent, or deinstall PA Stats.</p>'+
            '<p>If you want a specific game deleted from the page contact me (Cola_Colin) in the Uberent forums.</p>'+
            '<p>This message will be displayed once for every bigger update that is made to PA Stats.</p>'+
        '</div>'+
    '</div>'

        $("body").append(htmlMsg);

        if (lastVersion != paStatsGlobal.reportVersion) {
            $('#pa_stats_welcome').attr("style", "visibility:visible");
            $('#pa_stats_welcome').dialog({
                dialogClass: "no-close",
                closeOnEscape : false,
                draggable : false,
                resizable : false,
                height : 800,
                width : 800,
                modal : true,
                buttons : {
                    "ACCEPT" : function() {
                        localStorage[paStatsGlobal.pa_stats_stored_version] = paStatsGlobal.reportVersion;
                        $(this).dialog("close");
                    }
                }
            });
        }
    }

    showInfoMessage();

}

try
{
    paStats();
}
catch (e)
{
    console.log( e.stack || e );
}