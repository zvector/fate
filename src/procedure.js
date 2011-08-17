/**
 * A **procedure** declares an execution flow by grouping multiple functions into a nested array
 * structure.
 * 
 * Input is accepted in the form of nested function arrays of arbitrary depth, where a nested array
 * (literal `[ ]`) represents a group of functions to be executed in a serial queue (using a `Queue`
 * promise), and a nested **double array** (literal `[[ ]]`) represents a group of functions to be
 * executed as a parallel set (using the promise returned by a `when` invocation).
 */
function Procedure ( input ) {
	if ( !( this instanceof Procedure ) ) {
		return new Procedure( input );
	}
	
	var	procedure = parse( input ),
		deferral = ( new Deferral ).as( this );
	
	function parallel () {
		var args = slice.call( arguments );
		return function () {
			for ( var i = 0, l = args.length; i < l; i++ ) {
				args[i] = args[i].apply( procedure, arguments );
			}
			return when( args );
		};
	}
	function series () {
		var args = slice.call( arguments );
		return function () {
			return Queue( args ).start( arguments ).promise();
		};
	}
	
	function parse ( obj ) {
		var fn, array, i, l;
		if ( isFunction( obj ) ) {
			return obj;
		} else if ( isArray( obj ) ) {
			fn = obj.length === 1 && isArray( obj[0] ) ? ( obj = obj[0], parallel ) : series;
			for ( array = [], i = 0, l = obj.length; i < l; ) {
				array.push( parse( obj[ i++ ] ) );
			}
			return fn.apply( this, array );
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
