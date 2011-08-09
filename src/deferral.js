/**
`Deferral` is a stateful callback device used to manage the eventualities of asynchronous operations.

@param Array map : Hashmap whose entries represent the set of resolved substates for the deferral;
		keys specify a name for the substate's callback queue, and values specify a name for the
		resolution method used to transition to that substate and execute its associated callbacks.
@param Function fn : A function that will be executed immediately in the context of the deferral.
 */
function Deferral ( map, fn, args ) {
	var	self = this,
		callbacks,
		resolution,
		register, resolve;
	
	function setResolution ( name ) { return name in map && ( resolution = name ); }
	
	isFunction( map ) && ( args = fn, fn = map, map = undefined );
	map === undefined && ( map = { yes: 'affirm', no: 'negate' } );
	
	( this.empty = function () {
		callbacks = {};
		each( map, function ( key ) { callbacks[ key ] = []; });
		return this;
	})();
	this.map = function () { return extend( {}, map ); };
	this.queueNames = function () { return keys( map ); };
	this.resolution = function () { return resolution; };
	this.resolved = function ( to ) { return resolution ? ( !to || to === resolution ) : undefined; };
	this.did = function ( resolver ) { return resolver ? resolution && resolver === map[ resolution ] : !!resolution };
	
	register = Deferral.privileged.register( callbacks );
	resolve = Deferral.privileged.resolve( callbacks, setResolution );
	
	each( map, function ( name, resolver ) {
		self[ name ] = register( name );
		self[ resolver ] = resolve( name );
	});
	
	register = resolve = null;
	
	fn && isFunction( fn ) && fn.apply( this, args );
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
					isFunction( fn ) ? fn.apply( context, args ) :
					isArray( fn ) && Deferral.privileged.invokeAll( deferral, callbacks )( fn );
				} catch ( nothing ) {}
				return deferral;
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
		register: function ( callbacks ) {
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
		resolve: function ( callbacks, setResolution ) {
			return function ( as ) {
				return function ( context, args ) {
					var	self = this,
						name,
						map = this.map();
					delete map[as];
					
					setResolution( as );
					/*
					 * The deferral has transitioned to a 'resolved' substate ( e.g. affirmed | negated ),
					 * so the behavior of its callback registration methods are redefined to reflect this.
					 * Henceforth, functions passed to the method named `as` will be called immediately
					 * with the same `context` and `args` supplied here, while those passed to any of the
					 * other registration methods will be ignored.
					 */
					this[as] = Deferral.privileged.invoke( this, callbacks );
					this.resolve = getThis;
					for ( name in map ) { this[ name ] = getThis; }
					
					callbacks.context = context, callbacks.args = args;
					Deferral.privileged.invokeAll( this, callbacks )( callbacks[as] );
					
					delete callbacks[as];
					for ( name in map ) { delete callbacks[ name ]; }
					
					return this;
				};
			};
		}
	},
	prototype: {
		/**
		 * Unified interface for registering callbacks. Multiple arguments are registered to callback
		 * queues in respective order; e.g. `( new Deferral() ).then( fn1, fn2 )` registers `fn1` to the
		 * first queue (`yes`) and `fn2` to the second queue (`no`).
		 */
		then: function () {
			var map = keys( this.map() ), i = 0, l = Math.min( map.length, arguments.length );
			while ( i < l ) { this[ map[i] ]( arguments[i++] ); }
			return this;
		},
		
		/**
		 * Interface for adding callbacks that will execute once the deferral is resolved, regardless of
		 * whether it is affirmed or not.
		 */
		always: function () {
			var name, map = this.map(), fns = slice.call( arguments );
			for ( name in map ) { this[ name ]( fns ); }
			return this;
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
							promise ?
								promise.then( next.affirm, next.negate ) :
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
