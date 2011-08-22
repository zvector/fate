/**
 * A **procedure** defines an execution flow by nesting multiple parallel and serial function arrays.
 * 
 * Input is accepted in the form of nested function arrays, of arbitrary depth, where an array
 * literal `[ ]` represents a group of functions to be executed in a serial queue using a `Pipeline`,
 * a **double array literal** `[[ ]]` represents a group of functions to be executed as a parallel
 * set using a `when` invocation, and a **numerically-keyed array object literal** `{n:[ ]}`
 * represents a group of functions to be executed in parallel, up to `n` items concurrently, using a
 * `Multiplex` of width `n`.
 */
function Procedure ( input ) {
	if ( !( this instanceof Procedure ) ) {
		return new Procedure( input );
	}
	
	var	self = this,
		deferral = ( new Deferral ).as( this ),
		procedure = parse.call( this, input );
	
	function series () {
		var args = slice.call( arguments );
		return function () {
			return Pipeline( args ).start( arguments ).promise();
		};
	}
	function parallel () {
		var args = slice.call( arguments );
		return function () {
			var obj;
			for ( var i = 0, l = args.length; i < l; i++ ) {
				obj = args[i].apply( self, arguments );
				if ( !( isFunction( obj ) || Promise.resembles( obj ) ) ) {
					obj = Deferral.Nullary( self, obj );
				}
				args[i] = obj;
			}
			return Deferral.when( args );
		};
	}
	function multiplex ( width, args ) {
		return function () {
			return Multiplex( width, args ).start( arguments ).promise();
		};
	}
	
	function parse ( obj ) {
		var fn, array, i, l, kk, width;
		
		if ( isFunction( obj ) ) {
			return obj;
		}
		
		// Simple series or parallel literal: `[ ... ]` | `[[ ... ]]`
		else if ( isArray( obj ) ) {
			fn = obj.length === 1 && isArray( obj[0] ) ? ( obj = obj[0], parallel ) : series;
			for ( array = [], i = 0, l = obj.length; i < l; ) {
				array.push( parse.call( self, obj[ i++ ] ) );
			}
			return fn.apply( this, array );
		}
		
		// Multiplex literal: `{n:[ ... ]}`
		else if (
			isPlainObject( obj ) &&
			( kk = keys( obj ) ).length === 1 &&
			isNumber( width = +kk[0] )
		){
			obj = obj[ width ];
			for ( array = [], i = 0, l = obj.length; i < l; ) {
				array.push( parse.call( self, obj[ i++ ] ) );
			}
			return multiplex.apply( this, [ width, array ] );
		}
	}
	
	extend( this, {
		start: function () {
			var result = procedure.apply( this, arguments );
			function affirm () { return deferral.affirm(); }
			function negate () { return deferral.negate(); }
			Promise.resembles( result ) ? result.then( affirm, negate ) : affirm();
			return this.promise();
		},
		promise: function () {
			return deferral.promise();
		}
	});
}
