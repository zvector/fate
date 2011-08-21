/**
 * Binds together the fate of all `promises` as evaluated against the specified `resolution`. Returns a
 * `Promise` to a master `Deferral` that either: (1) will resolve to `yes` once all `promises` have
 * individually been resolved to the specified `resolution`; or (2) will resolve to `no` once any one of the
 * `promises` has been resolved to a different resolution. If no `resolution` is specified, it will default
 * to that of the first defined callback queue (e.g. `yes` for a standard deferral).
 */
function when ( /* promises..., [ resolution ] */ ) {
	var	promises = flatten( slice.call( arguments ) ),
		length = promises.length || 1,
		resolution,
		master = new Deferral,
		list = [],
		i, promise, queueNames, affirmativeQueue, map, name;
	
	function affirmed ( p ) {
		return function () {
			list.push( p ) === length && master.affirm.apply( master, list );
		};
	}
	function negated ( p ) {
		return function () {
			list.push( p );
			master.negate.apply( master, list );
		};
	}
	
	if ( length > 1 && type( promises[ length - 1 ] ) === 'string' ) {
		resolution = promises.splice( --length, 1 )[0];
	}
	
	for ( i = 0; i < length; i++ ) {
		promise = promises[i];
		if ( promise instanceof Deferral || promise instanceof Promise ) {
			queueNames = promise.queueNames();
			
			// (n > 0)-ary deferral: affirm on the matching queue and negate on any others
			if ( queueNames && queueNames.length ) {
				
				// Determine which of this promise's callback queues matches the specified `resolution`
				affirmativeQueue = resolution || queueNames[0];
			
				// `map` becomes a list referencing the callback queues not considered affirmative in this context
				map = promise.map();
				if ( affirmativeQueue in map ) {
					delete map[ affirmativeQueue ];
				} else {
					// Because this promise will never be resolved to match `resolution`, the master deferral
					// can be negated immediately
					list.push( promise );
					master.negate.apply( master, list );
					break;
				}
			
				promise[ affirmativeQueue ]( affirmed( promise ) );
				for ( name in map ) {
					promise[ name ]( negated( promise ) );
				}
			}
			
			// Nullary deferral: affirm immediately
			else {
				promise.then( affirmed( promise ) );
			}
		}
		
		// For foreign promise objects, we utilize the standard `then` interface
		else if ( Promise.resembles( promise ) ) {
			promise.then( affirmed( promise ), negated( promise ) );
		}
		
		// For anything that isn't promise-like, force whatever `promise` is to play nice with the
		// other promises by wrapping it in a nullary deferral.
		else {
			promises[i] = Deferral.Nullary( master, promise );
			isFunction( promise ) && promises[i].then( promise );
		}
	}
	
	return master.promise();
}
