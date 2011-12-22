function Future () {
	throw new TypeError; // abstract
}

Z.extend( 'deep', Future, {
	prototype: {
		/**
		 * Unified interface for registering callbacks. Multiple arguments are registered to the
		 * primary resolved substates in respective order, with a trailing argument added as a
		 * progress event listener; e.g. `Deferral().then( fn1, fn2, fn3 )` registers `fn1` to the
		 * first state (`yes`), `fn2` to the second state (`no`), and since `Deferral` has only
		 * two primary states, `fn3` is registered to the progress event.
		 */
		then: function () {
			var	promise = this.promise(),
				stateNames = Z.keys( promise.potential().substates ),
				i = 0, sl = stateNames.length, al = arguments.length, l = Math.min( sl, al ),
				arg;
			
			for ( ; i < l; i++ ) {
				( arg = arguments[i] ) && promise.resolved[ stateNames[i] ]( arg );
			}
			al > sl && promise.progress( arguments[i] );
			
			return this;
		},
		
		/**
		 * Interface for adding callbacks that will execute once the deferral is resolved,
		 * regardless of whether it is affirmed or not.
		 */
		always: function () {
			var	promise = this.promise(),
				fns = Z.slice.call( arguments ),
				stateNames = Z.keys( promise.potential().substates ),
				i = 0, l = stateNames.length;
			
			for ( ; i < l; i++ ) {
				promise.resolved[ stateNames[i] ]( fns );
			}
			
			return this;
		},
		
		/**
		 * Registers callbacks to a separate deferral, whose resolver methods are registered to the
		 * queues of this deferral, and returns a promise bound to the succeeding deferral. This
		 * arrangement forms a pipeline structure, which can be extended indefinitely with chained
		 * calls to `pipe`. Once resolved, the original deferral (`this`) passes its resolution
		 * state, context and arguments on to the succeeding deferral, whose callbacks may then
		 * likewise dictate the resolution parameters of a further `pipe`d deferral, and so on.
		 * 
		 * Synchronous callbacks that return immediately will cause the succeeding deferral to
		 * resolve immediately, with the same resolution state and context from its receiving
		 * deferral, and the callback's return value as its lone resolution argument. Asynchronous
		 * callbacks that return their own promise or deferral will cause the succeeding deferral
		 * to resolve similarly once the callback's own deferral is resolved.
		 */
		pipe: function () {
			var	self = this,
				promise = this.promise(),
			 	potential = promise.potential(),
				states = potential.substates,
				key, resolverName, fn,
				i = 0, l = arguments.length,
				next = new Deferral( potential );
		
			for ( key in states ) {
				if ( i < l ) {
					( function ( resolverName, fn ) {
						function pipe () {
							var key_,
								result = fn.apply( this, arguments ),
								promise_ = result && Future.resembles( result ) ?
									result.promise() :
									undefined;
							if ( promise_ ) {
								for ( key_ in states ) {
									promise_[ key_ ]( next[ states[ key_ ].resolverName() ] );
								}
							} else {
								next.as( this === self ? next : this )[ resolverName ]( result );
							}
						}
						self[ key ]( Z.isFunction( fn ) ? pipe : next[ resolverName ] );
					})( states[ key ].resolverName(), arguments[ i++ ] );
				} else { break; }
			}
			return next.promise();
		}
	},
	
	// Used to test whether an object is or might be able to act as a Future/Deferral/Promise.
	resembles: function ( obj ) {
		return obj && (
			obj instanceof this ||
			Z.isFunction( obj.then ) && Z.isFunction( obj.promise )
		);
	}
});