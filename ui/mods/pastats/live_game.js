var paStatsLoaded;

function paStats()
{

    if ( paStatsLoaded )
    {
        return;
    }

    loadScript( "coui://ui/mods/pastats/global.js" );

    paStatsLoaded = true;

// save isLocalGame for live_game_message
    localStorage.pa_stats_is_local_game = encode(model.isLocalGame());
// save lobbyId for game_over
    localStorage.pa_stats_lobbyId = encode(model.lobbyId());
    var gameIdent = model.lobbyId();
    var displayName = decode(sessionStorage['displayName']);
    var uberName = decode(localStorage['uberName']);
    var doNotSend = false;

    function ReportData() {
        var self = this;
        self.ident = "";
        self.reporterUberName = "";
        self.reporterDisplayName = "";
        self.reporterTeam = 0;
        self.observedTeams = [];
        self.showLive = true;
        self.firstStats = {};
        self.version = paStatsGlobal.reportVersion;
        self.planet = {};
        self.paVersion = "unknown";
        self.armyEvents = [];
        self.gameStartTime = 0;
    }

    // these are no longer part of the default live_game scene, so create my own
    var currentEnergy = ko.observable(0);
    var maxEnergy = ko.observable(0);
    var energyGain = ko.observable(0);
    var energyLoss = ko.observable(0);
    var currentMetal = ko.observable(0);
    var maxMetal = ko.observable(0);
    var metalGain = ko.observable(0);
    var metalLoss = ko.observable(0);
    var hasFirstResourceUpdate = ko.observable(false);

    var metalNet = ko.computed(function() {
        return metalGain() - metalLoss();
    });

    var energyNet = ko.computed(function() {
        return energyGain() - energyLoss();
    });

    var oldSimDead = handlers.sim_terminated;
    handlers.sim_terminated = function(payload) {
        paStatsGlobal.unlockGame();
        oldSimDead(payload);
    };

    var oldConnectionList = handlers.connection_disconnected;
    handlers.connection_disconnected = function(payload) {
        paStatsGlobal.unlockGame();
        oldConnectionList(payload);
    };

    var oldHandlerArmy = handlers.army;
    handlers.army = function(payload) {

        currentEnergy(payload.energy.current);
        maxEnergy(payload.energy.storage);
        energyGain(payload.energy.production);
        energyLoss(payload.energy.demand);

        currentMetal(payload.metal.current);
        maxMetal(payload.metal.storage);
        metalGain(payload.metal.production);
        metalLoss(payload.metal.demand);

        hasFirstResourceUpdate(true);

        if (oldHandlerArmy) {
            oldHandlerArmy(payload);
        }
    };

    model.showDataLive = ko.observable(true).extend({local: paStatsGlobal.showDataLiveKey})
    model.wantsToSend = ko.observable(true).extend({local : paStatsGlobal.wantsToSendKey});

    handlers["pastats.sendConfig"] = function(payload) {
        model.showDataLive(payload.showDataLive);
        model.wantsToSend(payload.wantsToSend);
    };

    function ValueChangeAccumulator(observable) {
        var self = this;
        self.tickValueAccumulation = 0;
        self.lastKnownValue = 0;
        self.lastChangeTime = new Date().getTime();

        self.doUpdate = function(newOldValue) {
            var timeOfChange = new Date().getTime();
            self.tickValueAccumulation += Math.round(self.lastKnownValue / 1000
                    * (timeOfChange - self.lastChangeTime));
            self.lastKnownValue = newOldValue;
            self.lastChangeTime = timeOfChange;
        };

        self.reset = function() {
            self.tickValueAccumulation = 0;
        }

        self.get = function() {
            self.doUpdate(observable());
            var v = self.tickValueAccumulation;
            self.tickValueAccumulation = 0;
            return v;
        }

        observable.subscribe(function(newValue) {
            self.doUpdate(newValue);
        });
    }

    var wastingMetalObs = ko.computed(function() {
        if (currentMetal() == maxMetal() && metalNet() > 0) {
            return metalNet();
        } else {
            return 0;
        }
    });

    var wastingEnergyObs = ko.computed(function() {
        if (currentEnergy() == maxEnergy() && energyNet() > 0) {
            return energyNet();
        } else {
            return 0;
        }
    });

    var metalProductionAccu = new ValueChangeAccumulator(metalGain);
    var energyProductionAccu = new ValueChangeAccumulator(energyGain);
    var metalWastingAccu = new ValueChangeAccumulator(wastingMetalObs);
    var energyWastingAccu = new ValueChangeAccumulator(wastingEnergyObs);

    var apmCnt = 0;

    // http://stackoverflow.com/questions/2360655/jquery-event-handlers-always-execute-in-order-they-were-bound-any-way-around-t
    // [name] is the name of the event "click", "mouseover", ..
    // same as you'd pass it to bind()
    // [fn] is the handler function
    $.fn.bindFirst = function(name, fn) {
        // bind as you normally would
        // don't want to miss out on any jQuery magic
        this.on(name, fn);

        // Thanks to a comment by @Martin, adding support for
        // namespaced events too.
        this.each(function() {
            var handlers = $._data(this, 'events')[name.split('.')[0]];
            // take out the handler we just inserted from the end
            var handler = handlers.pop();
            // move it at the beginning
            handlers.splice(0, 0, handler);
        });
    };

    var actionsSinceLastTick = 0;

    $(document).ready(function() {
        $(document).bindFirst("keyup", function(e) {
            actionsSinceLastTick++;
        });
        $(document).bindFirst("mousedown", function(e) {// click onto ui elements
            actionsSinceLastTick++;
        });
        $('holodeck').bindFirst("mousedown", function(e) { // click into 3d world
            actionsSinceLastTick++;
        });
    });

    function getApm() {
        var apm = actionsSinceLastTick;
        actionsSinceLastTick = 0;
        return apm;
    }

    var startedSendingStats = false;
    var gameLinkId = undefined;

    function maySetupReportInterval() {
        if (!startedSendingStats && !gameIsOverOrPlayerIsDead
                && paStatsGlobal.reportVersion >= localStorage['pa_stats_req_version']) {
            startedSendingStats = true;
            actionsSinceLastTick = 0;
            setInterval(model.sendStats, 5000);
        }
    }

    var gameIsOverOrPlayerIsDead = false;

    var playStartTime = undefined;

    function updatePlayStartTime() {
        var serverNow = getServerTimeForNow();
        if (serverNow != undefined) {
            playStartTime = serverNow;
        } else {
            var now = new Date().getTime();
            callServerTime(function(t) {
                var nowAfterCall = new Date().getTime();
                var diff = nowAfterCall - now;
                playStartTime = t-diff;
            });
        }
    }

    var capturedTeams = undefined;

    var handleOptions = function(payload) {
        if (payload.game_type && payload.game_type === "Galactic War") {
            doNotSend = true;
        }
    };

    var captureTeams = function(armies) {
        var teams = [];
        var myTeamIndex = -1;

        var findTeamByAllianceGroup = function(allianceGroup) {
            for (var i = 0; i < allianceGroup.length; i++) {
                for (j = 0; j < teams.length; j++) {
                    if (teams[j].allyIds.indexOf(allianceGroup[i].id) !== -1) {
                        return j;
                    }
                }
            }
            return -1;
        };

        for (var i = 0; i < armies.length; i++) {
            var a = armies[i];
            var teamIndex = findTeamByAllianceGroup(a.allies)
            var team = teamIndex !== -1 ? teams[teamIndex] : {index: teams.length, players:[], allyIds: []};
            if (teamIndex === -1) {
                team.primaryColor = "rgb("+a.primary_color[0]+","+a.primary_color[1]+","+a.primary_color[2]+")";
                team.secondaryColor = "rgb("+a.secondary_color[0]+","+a.secondary_color[1]+","+a.secondary_color[2]+")";
                teams.push(team);
            }
            team.allyIds.push(a.id);

            var aiAdd = a.ai ? "AI : " : "";
            for (var s = 0; s < a.slots.length; s++) {
                team.players.push({displayName: aiAdd + a.slots[s]});
            }

            if (a.stateToPlayer === 'self') {
                myTeamIndex = team.index;
            }
        }

        for (var i = 0; i < teams.length; i++) {
            delete teams[i].allyIds;
        }

        var fullData = {
            teams: teams,
            myTeamIndex: myTeamIndex
        };

        console.log(fullData);

        return fullData;
    };

    var oldHandleArmyState = handlers.army_state;
    handlers.army_state = function(m) {
        oldHandleArmyState(m);

        if (model.gameOptions.game_type() !== 'Galactic War' && !model.isSpectator()) {
            capturedTeams = captureTeams(m);
        }
    };

    var oldServerState = handlers.server_state;
    handlers.server_state = function(m) {
        if (m.state !== 'game_over' && m.url && m.url !== window.location.href) {
            paStatsGlobal.unlockGame();
        }
        switch(m.state) {
            case 'landing':
                pasHadReconnect = false;
                break;
            case 'game_over':
                gameIsOverOrPlayerIsDead = true;
                paStatsGlobal.unlockGame();
                break;
            case 'playing':
                updatePlayStartTime();
                maySetupReportInterval();
                break;
        }

        if (m.data.client && m.data.client.hasOwnProperty('game_options')) {
            handleOptions(m.data.client.game_options);
        }

        oldServerState(m);
    };

    var oldNavToMainMenupas = model.navToMainMenu;
    model.navToMainMenu = function() {
        paStatsGlobal.unlockGame(oldNavToMainMenupas);
    }

    var oldExitpas = model.exit;
    model.exit = function() {
        paStatsGlobal.unlockGame(oldExitpas);
    }

    hasFirstResourceUpdate.subscribe(function(v) {
        if (v) {
            maySetupReportInterval();
        }
    });

    var deathReported = false;
    var addedDeathListener = false;
    function addDeathListener() {
        addedDeathListener = true;
        model.armySize.subscribe(function(v) {
            if (v == 0 && !deathReported) { // army count = 0 > the player died!
                $.ajax({
                    type : "PUT",
                    url : paStatsGlobal.queryUrlBase + "report/idied",
                    contentType : "application/json",
                    data : JSON.stringify({
                        gameLink : gameLinkId
                    }),
                });
                deathReported = true;
            }
        });
    }

    var updateTimeCnt = 0;
    var mostRecentServerTime = undefined;
    var mostRecentServerTimeInLocalTime = undefined;

    function getServerTimeForNow() {
        if (mostRecentServerTimeInLocalTime == undefined) {
            return undefined;
        } else {
            var now = new Date().getTime();
            var diff = now - mostRecentServerTimeInLocalTime;
            return mostRecentServerTime + diff;
        }
    }

    function callServerTime(handler) {
        $.get(paStatsGlobal.queryUrlBase + "report/get/time", function(timeMs) {
            handler(timeMs);
        });
    }

    model.updateServerAndLocalTime = function () {
        callServerTime(function(timeMs) {
            mostRecentServerTime = timeMs.ms;
            mostRecentServerTimeInLocalTime = new Date().getTime();
        });
    }

    model.updateServerAndLocalTime();

    var pasCapturedEvents = [];

    var pasHadReconnect = true;
    var pasKnownIdLimit = undefined;
    var pasSeenConstructionEvents = {};

    alertsManager.addListener(function(payload) {
        function makeArmyEvent(spec, x, y, z, planetId, watchType, time) {
            var strip = /.*\.json/.exec(spec);
            if (strip) {
                spec = strip.pop();
            }

            return {
                spec: spec,
                x: x,
                y: y,
                z: z,
                planetId: planetId,
                watchType: watchType,
                time: time
            };
        }

        if (mostRecentServerTime !== undefined) { // in this case we just can wait until we have the first time. Should only matter for reconnects
            for (var i = 0; i < payload.list.length; i++) {
                var notice = payload.list[i];

                if (pasKnownIdLimit === undefined) {
                    // this check is based on the assumption that the unit ID will always go up. I wonder if that is correct
                    pasKnownIdLimit = notice.id; // below this id no checks for false "destroyed" events will be done to prevent huge problems in case of reconnects at the price of not perfect data (possibility for false destroy-events in case of destroyed half finished buildings from before the reconnect) in those case.
                }

                if (notice.watch_type == 0 || notice.watch_type == 2) {
                    if (notice.watch_type == 0) {
                        pasSeenConstructionEvents[notice.id] = true;
                    }

                    if (notice.watch_type != 2 || (pasHadReconnect && pasKnownIdLimit >= notice.id) || pasSeenConstructionEvents[notice.id]) {
                        if (notice.watch_type == 2) {
                            delete pasSeenConstructionEvents[notice.id]; // prevent the set from growing forever
                        }
                        pasCapturedEvents.push(makeArmyEvent(
                                notice.spec_id,
                                notice.location.x,
                                notice.location.y,
                                notice.location.z,
                                notice.planet_id,
                                notice.watch_type,
                                getServerTimeForNow())
                        );
                    } // else we got an "destroyed" event for a building that wasn't finished in the first place.
                }
            }
        }
    });

    var lastSimTime = undefined;
    var lastSimTimeCompare = undefined;
    var simSpeeds = [];

    var isOkayNumber = function(a) {
        return (typeof a==='number' && (a%1)===0)
    };

    var getSimSpeed = function() {
        var simSpeedLength = simSpeeds.length;
        if (simSpeedLength > 0) {
            var sum = 0;
            for (var i = 0; i < simSpeedLength; i++) {
                sum = sum + simSpeeds[i];
            }
            var foo = (sum / simSpeedLength).toFixed(0);
            var speed = Number(foo);
            simSpeeds = [];

            return speed === null || speed < 0 || speed > 9999 || !isOkayNumber(speed) ? 99 : speed;
        }
        return 100;
    };

    var oldTimeHandler = handlers.time;
    handlers.time = function(payload) {
        if (oldTimeHandler) {
            oldTimeHandler(payload);
        }

        if (lastSimTime && lastSimTimeCompare) {
            var simDt = payload.current_time - lastSimTime;
            var realDt = new Date().getTime()/1000 - lastSimTimeCompare;
            if (realDt > 0) {
                simSpeeds.push(Number(((simDt/realDt) * 100).toFixed(0)));
            }
        }

        lastSimTime = payload.current_time;
        lastSimTimeCompare = new Date().getTime() / 1000;
    };

    var sendReport = function(report) {
        var strData = JSON.stringify(report);
        // queryUrlBase is determined in global.js
        $.ajax({
            type : "PUT",
            url : paStatsGlobal.queryUrlBase + "report",
            contentType : "application/json",
            data : strData,
            success : function(result) {
                if (gameLinkId === undefined) {
                    gameLinkId = result.gameLink;
                    localStorage['pa_stats_game_link'] = encode(gameLinkId);
                    $("#pastatsadds").remove();
                }
            }
        });
    }

    model.sendStats = function() {
        if (!hasFirstResourceUpdate() // game has not yet started
                || gameIsOverOrPlayerIsDead // review
                || (model.armySize() == 0) // observer
                || model.isSpectator()
                || paStatsGlobal.reportVersion < localStorage['pa_stats_req_version'] // bad version
                || model.showTimeControls() // chonocam
                || (!decode(localStorage[paStatsGlobal.wantsToSendKey])) // user refused at the start of the game
                || playStartTime === undefined  // quering the starttime from the server has not yet been successful
                || model.isLocalGame()
                || doNotSend) { // do not report for local games, they miss a unique id
            actionsSinceLastTick = 0;
            simSpeeds = [];
            return;
        }

        if (playStartTime === null) {
            updatePlayStartTime();
            return;
        }

        updateTimeCnt++;
        if (updateTimeCnt % 12 == 0) {
            model.updateServerAndLocalTime();
        }

        if (!addedDeathListener) {
            addDeathListener();
        }

        var statsPacket = {};
        statsPacket.armyCount = model.armySize();
        statsPacket.metalIncomeNet = metalNet();
        statsPacket.energyIncomeNet = energyNet();
        statsPacket.metalStored = currentMetal();
        statsPacket.energyStored = currentEnergy();
        statsPacket.metalProducedSinceLastTick = metalProductionAccu.get();
        statsPacket.energyProducedSinceLastTick = energyProductionAccu.get();
        statsPacket.metalWastedSinceLastTick = metalWastingAccu.get();
        statsPacket.energyWastedSinceLastTick = energyWastingAccu.get();
        statsPacket.metalSpending = metalLoss();
        statsPacket.energySpending = energyLoss();
        statsPacket.metalIncome = metalGain();
        statsPacket.energyIncome = energyGain();
        statsPacket.apm = getApm();
        statsPacket.simSpeed = getSimSpeed();

        var report = undefined;

        if (gameLinkId === undefined) {
            report = new ReportData();

            var teams = capturedTeams;

            report.ident = gameIdent;
            report.reporterUberName = uberName;
            report.reporterDisplayName = displayName;
            report.reporterTeam = teams.myTeamIndex;
            report.observedTeams =  teams.teams;
            report.showLive = model.showDataLive();
            report.firstStats = statsPacket;
            report.paVersion = decode(sessionStorage['build_version']);
            report.isAutomatch = decode(localStorage['pa_stats_is_ranked']);

            report.planet = {
                json: localStorage['pa_stats_system']
            };

            report.armyEvents = pasCapturedEvents;

            report.gameStartTime = playStartTime;
        } else {
            report = {};
            report.gameLink = gameLinkId;
            report.stats = statsPacket;

            report.armyEvents = pasCapturedEvents;
        }

        pasCapturedEvents = [];

        sendReport(report);
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