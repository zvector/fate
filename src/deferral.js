/**
 * A deferral is a stateful callback device used to manage the eventualities of asynchronous operations.
 * 
 * In a deferral's initial 'unresolved' state, callbacks may be registered to either of two queues, named
 * 'yes' or 'no'. The functions in one of these queues will be executed later, pending a transition of
 * the deferral to one of two 'resolved' substates: 'affirmed' or 'negated'; this resolution transition
 * is effected by the deferral's `affirm` and `negate` methods, respectively. Both 'resolved' substates
 * are final, in that once a deferral is 'affirmed' or 'negated', it cannot be transitioned back to any
 * other state; furthermore, subsequent callbacks registered to the 'yes' or 'no' queues will be either
 * executed immediately or ignored, as appropriate.
 * 
 * At any time a deferral can issue a Promise. This is a subinterface bound to the deferral that allows
 * holders of the promise to make additions to its callback queues (`yes`, `no`, `then`, `always`), as
 * well as to query the associated deferral's state (`isResolved`, `isAffirmed`, `isNegated`), but not to
 * directly alter the deferral's state, as is done with the deferral's methods `affirm` and `negate`.
 */
function Deferral ( fn ) {
	var	callbacks, bind, resolve;
	
	( this.empty = function () {
		callbacks = { yes: [], no: [] };
		return this;
	})();
	
	bind = Deferral.privileged.bind( callbacks );
	resolve = Deferral.privileged.resolve( callbacks );
	extend( this, {
		/** Adds a function to the `yes` queue, to be executed pending `affirm()`. */
		yes: bind( 'yes' ),
		
		/** Adds a function to the `no` queue, to be executed pending `negate()`. */
		no: bind( 'no' ),
		
		/**
		 * Resolves the deferral by transitioning its state to 'affirmed' and `apply`ing the functions in
		 * its `yes` callback queue.
		 */
		affirm: resolve( 'yes' ),
		
		/**
		 * Resolves the deferral by transitioning its state to 'negated' and `apply`ing the functions in
		 * its `no` callback queue.
		 */
		negate: resolve( 'no' )
	});
	bind = resolve = null;
	
	fn && isFunction( fn ) && fn.apply( this, slice.call( arguments, 1 ) );
}
extend( true, Deferral, {
	anti: { yes: 'no', no: 'yes' },
	resolver: { yes: 'affirm', no: 'negate' },
	privileged: {
		/** Produces a function that will become the deferral's `yes` or `no` method once it has been resolved. */
		invoke: function ( deferral, callbacks ) {
			return function ( fn ) {
				var	context = callbacks.context || deferral,
					args = callbacks.args;
				try {
					// isFunction( fn ) ? fn.apply( callbacks.context || deferral, callbacks.args ) :
					isFunction( fn ) ? fn.apply( context, args ) :
					isArray( fn ) && Deferral.privileged.invokeAll( deferral, callbacks )( fn );
				} catch ( nothing ) {}
				return deferral; // !!fn;
			};
		},
		
		/** Analogue of `invoke`, for an array of callbacks. */
		invokeAll: function ( deferral, callbacks ) {
			return function ( fns ) {
				for ( i = 0, l = fns.length; i < l; i++ ) {
					Deferral.privileged.invoke( deferral, callbacks )( fns[i] );
				}
			};
		},
		
		/**
		 * Produces a function that pushes callbacks onto one of the callback queues.
		 * @see yes, no
		 */
		bind: function ( callbacks ) {
			return function ( as ) { // `as` = { 'yes' | 'no' }
				return function ( fn ) {
					isFunction( fn ) && callbacks[as].push( fn ) || isArray( fn ) && forEach( fn, this[as] );
					return this;
				};
			};
		},
		
		/**
		 * Produces a function that resolves the deferral as either affirmed or negated.
		 * @see affirm, negate
		 */
		resolve: function ( callbacks ) {
			// param `as` = { 'yes' | 'no' }
			return function ( as ) {
				var not = Deferral.anti[as];
				return function ( context, args ) {
					/*
					 * The deferral has transitioned to a 'resolved' substate ( 'affirmed' | 'negated' ),
					 * so the behavior of its `yes` and `no` methods are redefined to reflect this;
					 * henceforth, rather than being queued for later, functions passed to `yes` and
					 * `no` will be either called immediately or discarded.
					 */
					this[as] = Deferral.privileged.invoke( this, callbacks );
					this[not] = this.resolve = getThis;
					
					callbacks.context = context, callbacks.args = args;
					Deferral.privileged.invokeAll( this, callbacks )( callbacks[as] );
					
					delete callbacks[as], delete callbacks[not];
					
					return this;
				};
			};
		}
	},
	prototype: {
		/** Determines whether the deferral has been affirmed. */
		isAffirmed: function () {
			return this.no === getThis ? true : this.yes === getThis ? false : undefined;
		},
		
		/** Determines whether the deferral has been negated. */
		isNegated: function () {
			return this.yes === getThis ? true : this.no === getThis ? false : undefined;
		},
		
		/** Determines whether the deferral has been either affirmed or negated. */
		isResolved: function () {
			return this.yes === getThis || this.no === getThis;
		},
		
		/** Unified interface for adding `yes` and `no` callbacks. */
		then: function ( yes, no ) {
			return this.yes( yes ).no( no );
		},
		
		/**
		 * Interface for adding callbacks that will execute once the deferral is resolved, regardless of
		 * whether it is affirmed or not.
		 */
		always: function () {
			var fns = slice.call( arguments );
			return this.yes( fns ).no( fns );
		},
		
		/**
		 * Arranges deferrals in a pipeline.
		 * @param Function `yes`
		 * @param Function `no`
		 * Functions passed as the arguments may be asynchronous, returning a promise or deferral, in which
		 * case this deferral passes its resolution state to a successive deferral
		 * that return a deferral or promise Passing a promise or deferral as arguments for
		 * `yes` and/or `no` causes wherein the resolution of a preceding deferral
		 * (`this`) is passed.
		 */
		pipe: function ( yes, no ) {
			var	self = this,
				next = new Deferral;
			each( { yes: yes, no: no }, function ( queueName, fn ) {
				var resolver = Deferral.resolver[ queueName ];
				self[ queueName ](
					isFunction( fn ) ?
						function () {
							var result = fn.apply( this, arguments ),
								promise = result && Promise.resembles( result ) ?
									result.promise() : undefined;
							promise ? // result && isFunction( result.promise ) ?
								promise.then( next.affirm, next.negate ) : // result.promise().then( next.affirm, next.negate ) :
								next[ resolver ]( this === self ? next : this, [ result ] );
						} :
						next[ resolver ]
				);
			});
			return next.promise();
		},
		
		/** Returns a `Promise` bound to this deferral. */
		promise: function () {
			return new Promise( this );
		}
	},
	then: function () {
		return ( new Deferral() ).then( arguments );
	}
});
