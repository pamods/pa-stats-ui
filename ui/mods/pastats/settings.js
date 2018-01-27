var paStatsLoaded;

function paStats()
{

    if ( paStatsLoaded )
    {
        return;
    }

    loadScript( "coui://ui/mods/pastats/global.js" );

    paStatsLoaded = true;

    function PaStatsSettingsModel()
    {
        var self = this;
        var oldWantsToSend = ko.observable();
        var oldShowDataLive = ko.observable();

        self.reloadCleanState = function() {
            oldWantsToSend(decode(localStorage[paStatsGlobal.wantsToSendKey]));
            oldShowDataLive(decode(localStorage[paStatsGlobal.showDataLiveKey]));
        };

        self.reloadCleanState();

        self.wantsToSend = ko.observable(oldWantsToSend());
        self.showDataLive = ko.observable(oldShowDataLive());

        self.dirty = ko.computed(function() {
            return self.wantsToSend() !== oldWantsToSend() ||
                self.showDataLive() !== oldShowDataLive();
        });
    }

    var paStatsSettingsModel = new PaStatsSettingsModel();

    model.paStatsSettingsModel = paStatsSettingsModel;

    var oldClean = model.clean;
    model.clean = ko.computed(function() {
        return oldClean() && !model.paStatsSettingsModel.dirty();
    });

    var doStore = function() {
        paStatsOldOk();
        localStorage[paStatsGlobal.wantsToSendKey] = encode(paStatsSettingsModel.wantsToSend());
        localStorage[paStatsGlobal.showDataLiveKey] = encode(paStatsSettingsModel.showDataLive());
        paStatsSettingsModel.reloadCleanState();
    };

    var paStatsOldOk = model.save;
    model.save = function() {
        doStore();
        return paStatsOldOk();
    };

    var paStatsOldOkClose = model.saveAndExit;
    model.saveAndExit = function() {
        paStatsOldOkClose();
        doStore();
    };

    var paStatsOldDefaults = model.restoreDefaults;
    model.restoreDefaults = function() {
        paStatsOldDefaults();
        paStatsSettingsModel.wantsToSend(true);
        paStatsSettingsModel.showDataLive(true);
    };

    model.settingGroups().push("pastats");
    model.settingDefinitions()["pastats"] = {title:"PA Stats",settings:{}};

    $("div.container_settings").append('<div class="option-list pastats" data-bind="visible:($root.settingGroups()[$root.activeSettingsGroupIndex()] === \'pastats\'), with: model.paStatsSettingsModel" style="display: none;"><div id="pasttatssettingspanel" style="height: 400px; overflow: scroll; overflow-x:hidden;"><h3>Stats Collection</h3><div>Send data to PA Stats: <input type="checkbox" data-bind="checked: wantsToSend" /> (change applies when you reload UI)</div> <div data-bind="visible: wantsToSend"> Show live updates on the webpage: <input type="checkbox" data-bind="checked: showDataLive" /> (change applies after you start a new game)</div></div>');

}

try
{
    paStats();
}
catch (e)
{
    console.log( e.stack || e );
}