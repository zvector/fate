function Future () {
	throw new TypeError; // abstract
}

Z.inherit( Future, {
	/**
	 * Unified interface for registering callbacks. Multiple arguments are registered to callback
	 * queues in respective order; e.g. `Deferral().then( fn1, fn2 )` registers `fn1` to the
	 * first queue (`yes`) and `fn2` to the second queue (`no`).
	 */
	then: function () {
		var	potential = Z.keys( this.potential() ),
			i, l;
		potential[0] === '' && potential.shift();
		for ( i = 0, l = Math.min( potential.length, arguments.length ); i < l; i++ ) {
			this[ potential[i] ]( arguments[i] );
		}
		return this;
	},
	
	/**
	 * Interface for adding callbacks that will execute once the deferral is resolved, regardless of
	 * whether it is affirmed or not.
	 */
	always: function () {
		var	name,
			potential = this.potential(),
			fns = Z.slice.call( arguments );
		for ( name in potential ) {
			this[ name ]( fns );
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
			key, resolver, fn,
			i = 0, l = arguments.length,
			next = new Deferral( potential );
		for ( key in potential ) {
			if ( i < l ) {
				resolver = potential[ key ];
				fn = arguments[ i++ ];
				this[ key ](
					Z.isFunction( fn ) ?
						function () {
							var key,
								result = fn.apply( this, arguments ),
								promise_ = result && Promise.resembles( result ) ?
									result.promise() : undefined;
							if ( promise_ ) {
								for ( key in potential ) {
									promise_[ key ]( next[ potential[ key ] ] );
								}
							} else {
								next.as( this === self ? next : this )[ resolver ]( result );
							}
						} :
						next[ resolver ]
				);
			} else break;
		}
		return next.promise();
	}
}, {
	// Used to test whether an object is or might be able to act as a Future/Deferral/Promise.
	resembles: function ( obj ) {
		return obj && (
			obj instanceof Future ||
			Z.isFunction( obj.then ) && Z.isFunction( obj.promise )
		);
	}
});