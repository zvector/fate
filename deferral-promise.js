( function ( module, undefined ) {

var global = this;
// # Core functions


var	toString = Object.prototype.toString,
	hasOwn = Object.prototype.hasOwnProperty,
	trim = String.prototype.trim ?
		function ( text ) { return text == null ? '' : String.prototype.trim.call( text ); }:
		function ( text ) { return text == null ? '' : text.toString().replace( /^\s+/, '' ).replace( /\s+$/, '' ); };

/**
 * Calls the specified native function if it exists and returns its result; if no such function exists on
 * `obj` as registered in `__native.fn`, returns our unique `noop` (as opposed to `null` or `undefined`,
 * which may be a valid result from the native function itself).
 */
function __native ( item, obj /* , ... */ ) {
	var n = __native.fn[item];
	return n && obj[item] === n ? n.apply( obj, slice( arguments, 2 ) ) : noop;
}
__native.fn = {
	forEach: Array.prototype.forEach
};

/**
 * General-purpose empty function; also usable as a unique alternative "nil" type in strict-equal matches
 * whenever it's desirable to avoid traditional `null` and `undefined`.
 */
function noop () {}

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

function concat () { return Array.prototype.concat.apply( [], arguments ); }

function slice ( array, begin, end ) { return Array.prototype.slice.call( array, begin, end ); }

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
 * 
 */
function Deferral ( fn ) {
	var	callbacks, bind, resolve;
	
	( this.empty = function () {
		callbacks = { done: [], fail: [] };
		return this;
	})();
	
	this.__private__ = {
		callbacks: callbacks
	};
	
	bind = Deferral.privileged.bind( callbacks );
	resolve = Deferral.privileged.resolve( callbacks );
	extend( this, {
		done: bind( 'done' ),
		fail: bind( 'fail' ),
		fulfill: resolve( 'done' ),
		forfeit: resolve( 'fail' )
	});
	bind = resolve = null;
	
	fn && isFunction( fn ) && fn.apply( this, slice( arguments, 1 ) );
}
extend( true, Deferral, {
	anti: { done: 'fail', fail: 'done' },
	privileged: {
		/** Produces a function that pushes callbacks onto one of the callback queues. */
		bind: function ( callbacks ) {
			return function ( as ) { // as = { 'done' | 'fail' }
				return function ( fn ) {
					isFunction( fn ) && callbacks[as].push( fn ) || isArray( fn ) && forEach( fn, this[as] );
					return this;
				};
			};
		},
		
		/** Produces a function that resolves the deferral as either fulfilled or forfeited. */
		resolve: function ( callbacks ) {
			return function ( as ) { // as = { 'done' | 'fail' }
				var not = Deferral.anti[as];
				return function ( context, args ) {
					this[as] = this.invoke( callbacks ), this[not] = this.resolve = noop;
					callbacks.context = context, callbacks.args = args;
					this.invokeAll( callbacks )( callbacks[as] );
					delete callbacks[as], delete callbacks[not];
					return this;
				};
			};
		}
	},
	prototype: {
		/** Determines whether the deferral has been fulfilled. */
		isFulfilled: function () {
			return this.fail === noop ? true : this.done === noop ? false : undefined;
		},
		
		/** Determines whether the deferral has been forfeited. */
		isForfeited: function () {
			return this.done === noop ? true : this.fail === noop ? false : undefined;
		},
		
		/** Determines whether the deferral has been either fulfilled or forfeited. */
		isResolved: function () {
			return this.done === noop || this.fail === noop;
		},
		
		/** Returns a function that will become the deferral's `done` or `fail` method once it has been resolved. */
		invoke: function ( callbacks ) {
			var self = this;
			return function ( fn ) {
				try {
					isFunction( fn ) && fn.apply( callbacks.context || self, callbacks.args )
						||
					isArray( fn ) && self.invokeAll( callbacks )( fn );
				} catch ( nothing ) {}
				return !!fn;
			};
		},
		
		/** Analogue of `invoke`, for an array of callbacks. */
		invokeAll: function ( callbacks ) {
			var self = this;
			return function ( fns ) {
				while ( self.invoke( callbacks )( fns.shift() ) );
			};
		},
		
		/** Unified interface for adding `done` and `fail` callbacks. */
		then: function ( done, fail ) {
			return this.done( done ).fail( fail );
		},
		
		/**
		 * Interface for adding callbacks that will execute once the deferral is resolved, regardless of
		 * whether it is fulfilled or not.
		 */
		always: function () {
			var fns = slice( arguments );
			return this.done( fns ).fail( fns );
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
 * `Promise` is a limited interface into a `Deferral` instance. Consumers of the promise may add
 * callbacks to the represented deferral, and may check its resolved/fulfilled states, but cannot affect
 * the deferral itself as would be done with the deferral's `fulfill` and `forfeit` methods.
 */
function Promise ( deferral ) {
	var promise = this,
		i = Promise.methods.length;
	while ( i-- ) {
		( function ( name ) {
			promise[name] = function () {
				deferral[name].apply( deferral, arguments );
				return promise;
			};
		})( Promise.methods[i] );
	}
}
extend( Promise, {
	methods: 'isResolved isFulfilled done fail then always'.split(' '),
	
	/** Weakly duck-types an object against `Promise`, checking for `then()` */
	resembles: function ( obj ) {
		return obj && isFunction( obj.then );
	}
});


/**
 * Binds together the fate of all the deferrals submitted as arguments, returning a promise that will be
 * fulfilled only after all the individual deferrals are fulfilled, or will be forfeited immediately after
 * any one deferral is forfeited.
 */
function when ( arg /*...*/ ) {
	var	args = flatten( slice( arguments ) ),
		length = args.length || 1,
		unresolvedCount = length,
		i = 0,
		deferral = length === 1 ?
			arg instanceof Deferral ?
				arg
				:
				( deferral = new Deferral ).fulfill( deferral, arg )
			:
			new Deferral;
	
	function fulfill () {
		--unresolvedCount || deferral.fulfill( deferral, arguments );
	}
	
	if ( length > 1 ) {
		for ( ; i < length; i++ ) {
			arg = args[i];
			arg instanceof Deferral || arg instanceof Promise ||
				( arg = args[i] = ( new Deferral ).fulfill( deferral, arg ) );
			arg.then( fulfill, deferral.forfeit );
		}
	}
	
	return deferral.promise();
}


extend( global, module.exports, {
	Deferral: Deferral,
	Promise: Promise,
	// Operation: Operation,
	when: when
});

})( typeof module === 'undefined' ? { exports: {} } : module );

