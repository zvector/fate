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
		i, promise, affirmativeQueue, map, name;
	
	function affirmed ( p ) {
		return function () {
			list.push( p ) === length && master.affirm( master, list );
		};
	}
	function negated ( p ) {
		return function () {
			list.push( p );
			master.negate( master, list );
		};
	}
	
	if ( length > 1 && type( promises[ length - 1 ] ) === 'string' ) {
		resolution = promises.splice( --length, 1 )[0];
	}
	
	for ( i = 0; i < length; i++ ) {
		promise = promises[i];
		if ( promise instanceof Deferral || promise instanceof Promise ) {
			
			// Determine which of this promise's callback queues matches the specified `resolution`
			affirmativeQueue = resolution || promise.queueNames()[0];
			
			// `map` becomes a list referencing the callback queues not considered affirmative in this context
			map = promise.map();
			if ( affirmativeQueue in map ) {
				delete map[ affirmativeQueue ];
			} else {
				// Because this promise will never be resolved to match `resolution`, the master deferral
				// can be negated immediately
				list.push( promise );
				master.negate( master, list );
				break;
			}
			
			promise[ affirmativeQueue ]( affirmed( promise ) );
			for ( name in map ) {
				promise[ name ]( negated( promise ) );
			}
		}
		
		// For foreign promise objects, we utilize the standard `then` interface
		else if ( Promise.resembles( promise ) ) {
			promise.then( affirmed( promise ), negated( promise ) );
		}
		
		// For anything that isn't promise-like, force it to play nice with the other promises by
		// wrapping it in an immediately affirmed deferral
		else {
			promises[i] = ( isFunction( promise ) ? new Deferral( promise ) : new Deferral )
				.affirm( master, [ promise ] );
		}
	}
	
	return master.promise();
}
