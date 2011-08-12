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
	isArray( array ) || ( array = [ array ] );
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
		result.push( key );
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
`Deferral` is a stateful callback device used to manage the eventualities of asynchronous operations.

@param Array map : Hashmap whose entries represent the set of resolved substates for the deferral;
		keys specify a name for the substate's callback queue, and values specify a name for the
		resolution method used to transition to that substate and execute its associated callbacks.
@param Function fn : A function that will be executed immediately in the context of the deferral.
 */
function Deferral ( map, fn, args ) {
	if ( !( this instanceof Deferral ) ) {
		return new Deferral( map, fn, args );
	}
	
	var	self = this,
		callbacks,
		resolution,
		register, resolve,
		promise;
	
	function setResolution ( name ) { return name in map && ( resolution = name ); }
	
	isFunction( map ) && ( args = fn, fn = map, map = undefined );
	map === undefined && ( map = { yes: 'affirm', no: 'negate' } );
	
	extend( this, {
		empty: function () {
			callbacks = {};
			each( map, function ( key ) { callbacks[ key ] = []; });
			return this;
		},
		map: function () { return extend( {}, map ); },
		queueNames: function () { return keys( map ); },
		resolution: function ( test ) {
			return test ? test === resolution || ( test in map ? false : undefined ) : resolution;
		},
		did: function ( resolver ) {
			return resolver ? !!resolution && resolver === map[ resolution ] : !!resolution;
		},
		promise: function () {
			return promise || ( promise = new Promise( this ) );
		},
		as: function ( context ) {
			callbacks.context = context;
			return this;
		}
	});
	this.queueNames.toString = function () { return self.queueNames().join(' ') };
	this.resolution.toString = this.resolution;
	
	this.empty();
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
		 * Produces a function that resolves the deferral, transitioning it to one of its resolved substates.
		 * @see affirm, negate
		 */
		resolve: function ( callbacks, setResolution ) {
			return function ( as ) {
				return function ( context, args ) {
					var	self = this,
						name,
						map = this.map();
					
					setResolution( as );
					/*
					 * The deferral has transitioned to a 'resolved' substate ( e.g. affirmed | negated ),
					 * so the behavior of its callback registration methods are redefined to reflect this.
					 * Henceforth, functions passed to the method named `as` will be called immediately
					 * with the same `context` and `args` supplied here, while those passed to any of the
					 * other registration methods will be ignored.
					 */
					this[as] = Deferral.privileged.invoke( this, callbacks );
					this[ map[as] ] = getThis;
					delete map[as];
					for ( name in map ) {
						this[ name ] = this[ map[ name ] ] = getThis;
					}
					
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
				map = this.map(),
				key, resolver, fn,
				i = 0, l = arguments.length,
				next = new Deferral;
			for ( key in map ) {
				if ( i < l ) {
					resolver = map[key];
					fn = arguments[i++];
					this[key](
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
				} else break;
			}
			return next.promise();
		}
	}
});


function UnaryDeferral ( fn, args ) {
	if ( !( this instanceof UnaryDeferral ) ) { return new UnaryDeferral( fn, args ); }
	Deferral.call( this, { done: 'resolve' }, fn, args );
}
UnaryDeferral.prototype = Deferral.prototype;
Deferral.Unary = UnaryDeferral;


function BinaryDeferral ( fn, args ) {
	if ( !( this instanceof BinaryDeferral ) ) { return new BinaryDeferral( fn, args ); }
	Deferral.call( this, { yes: 'affirm', no: 'negate' }, fn, args );
}
BinaryDeferral.prototype = Deferral.prototype;
Deferral.Binary = BinaryDeferral;

/**
 * `Promise` is a limited interface into a `Deferral` instance, consisting of a particular subset of
 * the deferral's methods. Consumers of the promise are prevented from affecting the represented
 * deferral's resolution state, but they can use it to query its state and add callbacks.
 */
function Promise ( deferral ) {
	var self = this,
		list = Promise.methods.concat( deferral.queueNames() ),
		i = list.length;
	while ( i-- ) {
		( function ( name ) {
			self[ name ] = function () {
				var result = deferral[ name ].apply( deferral, arguments );
				return result === deferral ? self : result;
			};
		})( list[i] );
	}
	this.serves = function ( master ) { return master === deferral; };
}
extend( true, Promise, {
	methods: 'then always pipe promise did resolution map queueNames'.split(' '),
	
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

