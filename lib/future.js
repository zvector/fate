function Future () {
	throw new TypeError; // abstract
}

Z.extend( 'deep', Future, {
	prototype: {
		potential: function () {
			throw new TypeError; // virtual
		},
		
		/**
		 * Unified interface for registering callbacks. Multiple arguments are registered to callback
		 * queues in respective order; e.g. `Deferral().then( fn1, fn2 )` registers `fn1` to the
		 * first queue (`yes`) and `fn2` to the second queue (`no`).
		 */
		then: function () {
			var	stateNames = Z.keys( this.potential().substates ),
				i = 0, sl = stateNames.length, al = arguments.length, l = Math.min( sl, al );
			for ( ; i < l; i++ ) {
				this.resolved[ stateNames[i] ]( arguments[i] );
			}
			al > sl && this.progress( arguments[i] );
			return this;
		},
		
		/**
		 * Interface for adding callbacks that will execute once the deferral is resolved, regardless of
		 * whether it is affirmed or not.
		 */
		always: function () {
			var	fns = Z.slice.call( arguments ),
				stateNames = Z.keys( this.potential().substates ),
				i = 0, l = stateNames.length;
			for ( ; i < l; i++ ) {
				this.resolved[ stateNames[i] ]( fns );
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
			 	potential = this.potential(),
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