var paStatsLoaded;

function paStats()
{

    if ( paStatsLoaded )
    {
        return;
    }

    loadScript( "coui://ui/mods/pastats/global.js" );

    paStatsLoaded = true;

    model.showDataLive = ko.observable(true).extend({local: paStatsGlobal.showDataLiveKey})
    model.wantsToSend = ko.observable(true).extend({local : paStatsGlobal.wantsToSendKey});

    model.liveShouldBeVisible = ko.computed(function() {
        return model.wantsToSend();
    });

    var sendConfig = function(showLive, sendData) {
        api.Panel.message(api.Panel.parentId, 'pastats.sendConfig', {
            showDataLive: showLive,
            wantsToSend: sendData
        });
    };

    model.showDataLive.subscribe(function(v) {
        sendConfig(v, model.wantsToSend());
    });

    model.wantsToSend.subscribe(function(v) {
        sendConfig(model.showDataLive(), v);
    });

    if (decode(localStorage.pa_stats_is_local_game)) {
        $(".div_instruct_bar").prepend('<div id="pastatsadds">Local games cannot report to PA Stats.</div>');
    } else {
        $(".div_instruct_bar").prepend(
                '<div id="pastatsadds"><div>Send data to PA Stats: <input type="checkbox" data-bind="checked: wantsToSend"/></div>'+
                '<div data-bind="visible: liveShouldBeVisible">Show live updates on the webpage: <input type="checkbox" data-bind="checked: showDataLive"/></div></div>');
    }

    var oldClick = model.clickButton;

    model.clickButton = function() {
        oldClick();
        $('#pastatsadds').remove();
    };

}

try
{
    paStats();
}
catch (e)
{
    console.log( e.stack || e );
}