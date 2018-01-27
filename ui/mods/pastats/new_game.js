var paStatsLoaded;

function paStats()
{
    
    if ( paStatsLoaded )
    {
        return;
    }

    paStatsLoaded = true;

    localStorage['pa_stats_is_ranked'] = encode(false);

	model.system.subscribe(function(system) {
    	
        minSystem = _.omit( system, ['planets'] );
     	minSystem.planets = _.map( system.planets, function( planet ) { return _.omit( planet, ['source', 'planetCSG' ] ); } );

        localStorage['pa_stats_system'] = JSON.stringify(minSystem);
	});
}

try
{
    paStats();
}
catch (e)
{
    console.log( e.stack || e );
}