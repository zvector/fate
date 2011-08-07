( function ( module, undefined ) {

var global = this;
// # Core functions


var	toString = Object.prototype.toString,
	hasOwn = Object.prototype.hasOwnProperty,
	trim = String.prototype.trim ?
		function ( text ) { return text == null ? '' : String.prototype.trim.call( text ); } :
		function ( text ) { return text == null ? '' : text.toString().replace( /^\s+/, '' ).replace( /\s+$/, '' ); },
	slice = Array.prototype.slice;
	
/**
 * Calls the specified native function if it exists and returns its result; if no such function exists on
 * `obj` as registered in `__native.fn`, returns our unique `noop` (as opposed to `null` or `undefined`,
 * which may be a valid result from the native function itself).
 */
function __native ( item, obj /* , ... */ ) {
	var n = __native.fn[item];
	return n && obj[item] === n ? n.apply( obj, slice.call( arguments, 2 ) ) : noop;
}
__native.fn = {
	forEach: Array.prototype.forEach
};

/**
 * General-purpose empty function; also usable as a unique alternative "nil" type in strict-equal matches
 * whenever it's desirable to avoid traditional `null` and `undefined`.
 */
function noop () {}

/** */
function getThis () { return this; }

/**
 * Safer alternative to `typeof`
 */
function type ( obj ) {
	return obj == null ? String( obj ) : type.map[ toString.call( obj ) ] || 'object';
}
type.map = {};
each( 'Array Boolean Date Function Number Object RegExp String'.split(' '), function( i, name ) {
	type.map[ "[object " + name + "]" ] = name.toLowerCase();
});

/** isNumber */
function isNumber ( n ) { return !isNaN( parseFloat( n ) && isFinite( n ) ); }

/** isArray */
function isArray ( obj ) { return type( obj ) === 'array'; }

/** isFunction */
function isFunction ( obj ) { return type( obj ) === 'function'; }

/** isPlainObject */
function isPlainObject ( obj ) {
	if ( !obj || type( obj ) !== 'object' || obj.nodeType || obj === global ||
		obj.constructor &&
		!hasOwn.call( obj, 'constructor' ) &&
		!hasOwn.call( obj.constructor.prototype, 'isPrototypeOf' )
	) {
		return false;
	}
	for ( var key in obj ) {}
	return key === undefined || hasOwn.call( obj, key );
}

/** isEmpty */
function isEmpty ( obj, andPrototype ) {
	if ( isArray( obj ) && obj.length ) {
		return false;
	}
	for ( var key in obj ) {
		if ( andPrototype || hasOwn.call( obj, key ) ) {
			return false;
		}
	}
	return true;
}

/** extend */
function extend () {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[0] || {},
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if ( typeof target === "boolean" ) {
		deep = target;
		target = arguments[1] || {};
		// skip the boolean and the target
		i = 2;
	}

	// Handle case when target is a string or something (possible in deep copy)
	if ( typeof target !== "object" && !isFunction( target ) ) {
		target = {};
	}

	for ( ; i < length; i++ ) {
		// Only deal with non-null/undefined values
		if ( ( options = arguments[i] ) != null ) {
			// Extend the base object
			for ( name in options ) {
				src = target[ name ];
				copy = options[ name ];

				// Prevent never-ending loop
				if ( target === copy ) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if ( deep && copy && ( isPlainObject( copy ) || ( copyIsArray = isArray( copy ) ) ) ) {
					if ( copyIsArray ) {
						copyIsArray = false;
						clone = src && isArray( src ) ? src : [];
					} else {
						clone = src && isPlainObject( src ) ? src : {};
					}
					
					// Never move original objects, clone them
					target[ name ] = extend( deep, clone, copy );
					
				// 
				// Don't bring in undefined values
				} else if ( copy !== undefined ) {
					target[ name ] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
}

function each ( obj, fn ) {
	if ( !obj ) return;
	var	key, i, l = obj.length;
	if ( l === undefined || isFunction( obj ) ) {
		for ( key in obj ) {
			if ( fn.call( obj[key], key, obj[key], obj ) === false ) {
				break;
			}
		}
	} else {
		for ( i = 0, l = obj.length; i < l; ) {
			if ( fn.call( obj[i], i, obj[i++], obj ) === false ) {
				break;
			}
		}
	}
	return obj;
}

function forEach ( obj, fn, context ) {
	var	n, l, key, i;
	if ( obj == null ) return;
	if ( ( n = __native( 'forEach', obj, fn, context ) ) !== noop ) return n;
	if ( ( l = obj.length ) === undefined || isFunction( obj ) ) {
		for ( key in obj ) {
			if ( fn.call( context || obj[key], obj[key], key, obj ) === false ) {
				break;
			}
		}
	} else {
		for ( i = 0, l = obj.length; i < l; ) {
			if ( fn.call( context || obj[i], obj[i], i++, obj ) === false ) {
				break;
			}
		}
	}
	return obj;
}

/**
 * Extracts elements of nested arrays
 */
function flatten ( array ) {
	var	i = 0,
		l = array.length,
		item,
		result = [];
	while ( i < l ) {
		item = array[i++];
		isArray( item ) ? ( result = result.concat( flatten( item ) ) ) : result.push( item );
	}
	return result;
}

/**
 * Returns an array containing the keys of a hashmap
 */
function keys ( obj ) {
	var key, result = [];
	for ( key in obj ) if ( hasOwn.call( obj, key ) ) {
		result.push( i );
	}
	return result;
}

/**
 * Returns a hashmap that is the key-value inversion of the supplied string array
 */
function invert ( array ) {
	for ( var i = 0, l = array.length, map = {}; i < l; ) {
		map[ array[i] ] = i++;
	}
	return map;
}

/**
 * Sets all of an object's values to a specified value
 */
function setAll ( obj, value ) {
	for ( var i in obj ) if ( hasOwn.call( obj, i ) ) {
		obj[i] = value;
	}
	return obj;
}

/**
 * Sets all of an object's values to `null`
 */
function nullify ( obj ) {
	for ( var i in obj ) if ( hasOwn.call( obj, i ) ) {
		obj[i] = null;
	}
	return obj;
}

/**
 * Produces a hashmap whose keys are the supplied string array, with values all set to `null`
 */
function nullHash( keys ) { return nullify( invert( keys ) ); }


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


/**
 * `Promise` is a limited interface into a `Deferral` instance. It exposes a subset of the deferral's
 * methods, such that consumers of the promise may use it to add callbacks to the represented deferral,
 * and to query the deferral's state, but are prevented from affecting its state as would be done with
 * the deferral's `affirm` and `negate` methods.
 */
function Promise ( deferral ) {
	var self = this,
		i = Promise.methods.length;
	while ( i-- ) {
		( function ( name ) {
			self[ name ] = function () {
				var result = deferral[ name ].apply( deferral, arguments );
				return result === deferral ? self : result;
			};
		})( Promise.methods[i] );
	}
	this.serves = function ( master ) {
		return master === deferral;
	};
}
extend( true, Promise, {
	methods: 'isAffirmed isNegated isResolved yes no then always pipe promise'.split(' '),
	
	// Used to test whether an object is or might be able to act as a Promise.
	resembles: function ( obj ) {
		return obj && (
			obj instanceof Promise ||
			obj instanceof Deferral ||
			isFunction( obj.then ) && isFunction( obj.promise )
		);
	}
});


/**
 * Binds together the fate of all the deferrals submitted as arguments. Returns a promise which will be
 * either affirmed after each individual deferral is affirmed, or negated immediately after any one
 * deferral is negated.
 */
function when ( arg /*...*/ ) {
	var	args = flatten( slice.call( arguments ) ),
		length = args.length || 1,
		unresolvedCount = length,
		i = 0,
		deferral = length === 1 ?
			arg instanceof Deferral ?
				arg
				:
				( deferral = new Deferral ).affirm( deferral, arg )
			:
			new Deferral;
	
	function affirm () {
		--unresolvedCount || deferral.affirm( deferral, arguments );
	}
	
	if ( length > 1 ) {
		for ( ; i < length; i++ ) {
			arg = args[i];
			arg instanceof Deferral || arg instanceof Promise ||
				( arg = args[i] = ( new Deferral ).affirm( deferral, arg ) );
			arg.then( affirm, deferral.negate );
		}
	}
	
	return deferral.promise();
}


function OperationQueue ( operations ) {
	var	self = this,
		queue = slice.call( operations ),
		operation,
		args,
		deferral,
		running = false,
		pausePending = false;
	
	function continuation () {
		var result;
		if ( isFunction( this ) ) {
			result = this.apply( self, arguments );
			if ( Promise.resembles( result ) ) {
				result.then(
					function () {
						args = slice.call( arguments );
						pausePending && ( running = pausePending = false );
						running && continuation.apply( operation = queue.shift(), args );
					},
					function () {
						deferral.negate( self, args );
					}
				);
			} else {
				args = slice.call( arguments );
				running && continuation.apply( operation = queue.shift(), isArray( result ) ? result : [ result ] );
			}
		} else {
			deferral.affirm( self.stop(), arguments );
		}
	}
	function start () {
		deferral = new Deferral;
		running = true;
		this.start = getThis, this.pause = pause, this.resume = resume, this.stop = stop;
		continuation.apply( operation = queue.shift(), args = slice.call( arguments ) );
		return this;
	}
	function pause () {
		pausePending = true;
		this.resume = resume, this.pause = getThis;
		return this;
	}
	function resume () {
		running = true, pausePending = false;
		this.pause = pause, this.resume = getThis;
		continuation.apply( operation = queue.shift(), args );
		return this;
	}
	function stop () {
		running = pausePending = false;
		this.start = start, this.pause = this.resume = this.stop = getThis;
		return this;
	}
	
	forEach( 'push pop shift unshift reverse splice'.split(' '), function ( method ) {
		self[ method ] = function () {
			return Array.prototype[ method ].apply( queue, arguments );
		};
	});
	
	extend( this, {
		length: ( function () {
			function f () { return queue.length; }
			return ( f.valueOf = f );
		})(),
		promise: function () {
			return deferral.promise();
		},
		operation: function () { return operation; },
		args: function () { return slice.call( args ); },
		start: start,
		pause: getThis,
		resume: getThis,
		stop: getThis,
		isRunning: ( function () {
			function f () { return running; }
			return ( f.valueOf = f );
		})()
	});
}


extend( global, module.exports, {
	Deferral: Deferral,
	Promise: Promise,
	// Operation: Operation,
	OperationQueue: OperationQueue,
	when: when
});

})( typeof module === 'undefined' ? { exports: {} } : module );

