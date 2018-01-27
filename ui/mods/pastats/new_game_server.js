var paStatsServerLoaded;

(function() {


    if ( paStatsServerLoaded )
    {
        console.log( "PA Stats new_game_server.js already loaded" );
        return;
    }

    paStatsServerLoaded = true;

    console.log("PA Stats new_game_server.js");

    model.paStatsServer_isActuallyLoaded = ko.observable( false );

    model.paStatsServer_isHost = ko.computed( function()
    {
        return model.isGameCreator() && model.paStatsServer_isActuallyLoaded();
    });

    var paStatsServer_checkLoaded = function()
    {
        api.mods.getMountedMods( 'server', function ( mods )
        {
            var loaded = _.intersection( _.pluck( mods, 'identifier' ), [ 'info.nanodesu.pastats.server.server', 'info.nanodesu.pastats.server.server-TEST' ] ).length > 0;

            model.paStatsServer_isActuallyLoaded( loaded );
        });
    }

// once mod data is sent check if pa stats server is actually loaded

    if ( window.scene_server_mod_list && window.scene_server_mod_list.new_game )
    {
        paStatsServer_checkLoaded();
    }
    else
    {
        var paStatsServer_server_mod_info_updated_handler = handlers.server_mod_info_updated;

        handlers.server_mod_info_updated = function( payload )
        {
            paStatsServer_server_mod_info_updated_handler( payload );

            paStatsServer_checkLoaded();
        }
    }

    var oldChatHandler = handlers.chat_message;

    handlers.chat_message = function(payload)
    {

        if (payload.message.indexOf('"id":"pastats-custom-message"') !== -1)
        {

            if ( model.paStatsServer_isHost() )
            {
                return;
            }

            var data = JSON.parse(payload.message);
            if (decode(localStorage['lobbyId']) !== data.lobbyId) {
                localStorage['lobbyId'] = encode(data.lobbyId);
                localStorage[paStatsGlobal.isRankedGameKey] = encode(false);
                localStorage[paStatsGlobal.isLocalGame] = encode(false);
                console.log("PA Stats new_game_server.js received lobbyId: "+ data.lobbyId);
            }
        } else {
            oldChatHandler(payload);
        }
    };

    model.paStatsServer_isHost.subscribe( function( isHost )
    {

        if ( isHost )
        {

            var paStatsServer_players_handler = handlers.players;

            handlers.players = function( payload )
            {
                paStatsServer_players_handler( payload );

                if ( ! _.isEmpty( payload ) )
                {

                    var lobbyId = decode( localStorage['lobbyId'] );

                    console.log("PA Stats new_game_server.js sending lobbyId: " + lobbyId );

                    var data = {};
                    data.id = "pastats-custom-message";
                    data.lobbyId = lobbyId ;
                    model.send_message("chat_message", { message: JSON.stringify(data) } );
                }
            }

        }
    });

}());
