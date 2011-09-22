/**
 * A **procedure** defines an execution flow by nesting multiple parallel and serial function arrays.
 * 
 * Input is accepted in the form of nested function arrays, of arbitrary depth, where an array
 * literal `[ ]` represents a group of functions to be executed in a serial queue using a `Pipeline`;
 * a **double array literal** `[[ ]]` represents a group of functions to be executed as a parallel
 * set using a `when` invocation; a **numerically-keyed object–bound array literal** `{n:[ ]}`
 * represents a group of functions to be executed in parallel, up to `n` items concurrently, using a
 * `Multiplex` of width `n`; and a **block literal** `['type', ... ]` represents a control structure,
 * where `type` may be a statement such as `if`, `while`, `for`, etc., any of which direct the flow
 * of asynchronous execution in a manner analogous to their respective language-level counterparts.
 */
function Procedure ( input, scope ) {
	if ( !( this instanceof Procedure ) ) {
		return new Procedure( input, scope );
	}
	
	var	self = this,
		deferral = ( new Deferral ).as( scope ),
		procedure = parse.call( scope, input );
	
	function downscope ( from ) {
		// TODO: shim for Object.create
		return Object.create( from || scope || null, { __procedure__: self } );
	}
	
	function parse ( obj, index, container ) {
		var statement, label, fn, array, kk, i, l, width;
		
		if ( Z.isFunction( obj ) ) {
			return obj;
		}
		
		else if ( Z.type( obj ) === 'string' ) {
			// Control statement: `return` | `break` | `continue`
			// `return` issues `stop()` on `this.__procedure__` and resolves the procedure deferral
			// `break` issues `stop()` on `this.__block__` and resolves the block deferral
			// `continue` issues `stop()` on `this.__block__` without resolving the block deferral
		}
		
		else if ( Z.isArray( obj ) ) {
			
			// Control block: `[ 'if' etc, function, [ ... ] ]`
			if ( Z.type( statement = obj[0] ) === 'string' ) {
				// TODO: labels ??
				return Procedure.statements[ statement ].apply( this, obj.slice(1) );
			}
			
			// Simple series or parallel literal: `[ ... ]` | `[[ ... ]]`
			else {
				fn = obj.length === 1 && Z.isArray( obj[0] ) ?
					( obj = obj[0], Procedure.structures.parallel ) :
					Procedure.structures.series;
				
				for ( array = [], i = 0, l = obj.length; i < l; i++ ) {
					array.push( parse.call( downscope( this ), obj[i], i, obj ) );
				}
				
				return fn.apply( this, array );
			}
		}
		
		// Multiplex literal: `{n:[ ... ]}`
		else if (
			Z.isPlainObject( obj )
			&& ( kk = Z.keys( obj ) ).length === 1
			&& Z.isNumber( width = Math.round( +kk[0] ) )
			&& Z.isArray( obj = obj[ width ] )
		) {
			for ( array = [], i = 0, l = obj.length; i < l; i++ ) {
				array.push( parse.call( downscope( this ), obj[i], i, obj ) );
			}
			return Procedure.structures.multiplex.call( this, width, array );
		}
	}
	
	Z.extend( this, {
		as: function ( context ) {
			return deferral.as( context );
		},
		given: function ( args ) {
			return deferral.given( args );
		},
		start: function () {
			var result = procedure.apply( self, arguments );
			
			function affirm () {
				return deferral.as( result ).given( arguments ).affirm();
			}
			function negate () {
				return deferral.as( result ).given( arguments ).negate();
			}
			
			Promise.resembles( result ) ?
				result.then( affirm, negate ) :
				( result ? affirm : negate ).apply( self, result );
			
			return self.promise();
		},
		promise: function () {
			return deferral.promise();
		}
	});
}

Z.extend( true, Procedure, {
	structures: {
		series: function () {
			var args = Z.slice.call( arguments );
			return function () {
				var pipeline = Pipeline( args );
				return pipeline.start.apply( pipeline, arguments ).promise();
			};
		},
	
		parallel: function () {
			var	scope = this,
				args = Z.slice.call( arguments );
			return function () {
				for ( var obj, i = 0, l = args.length; i < l; i++ ) {
					obj = args[i].apply( scope, arguments );
					if ( !( Z.isFunction( obj ) || Promise.resembles( obj ) ) ) {
						obj = Deferral.Nullary( scope, obj );
					}
					args[i] = obj;
				}
				return Deferral.when( args );
			};
		},
	
		multiplex: function ( width, args ) {
			return function () {
				return Multiplex( width, args ).start( arguments ).promise();
			};
		},
	
		branch: function ( condition, potential ) {
			var scope = this;
			return function () {
				var promise;
				
				// Evaluate `condition` as a new Procedure
				( condition = Procedure( condition, scope ) )
					.start.apply( condition, arguments )
					.then(
						
					)
				;
				
				Z.isFunction( condition ) && ( condition = condition.apply( arguments ) );
				
				promise = Promise.resembles( condition ) ?
					condition :
					Deferral().as( scope ).given( arguments )[ condition ? 'affirm' : 'negate' ]().promise();
				
				promise.always( function () {
					var resolution = promise.resolution();
					condition[ resolution ]( function () {
						return Procedure( potential[ resolution ], scope ).start.apply( this, arguments ).promise();
					});
				});
				
				return promise;
			};
		},
	
		loop: function ( initialization, precondition, procedure, postcondition ) {
		
		},
	
		exception: function ( attempt, errorPotential ) {
		
		}
	},
	
	statements: {
		'if': function ( condition, potential ) {
			return Procedure.structures.branch.call( this, condition, potential );
		},
		'while': function ( condition, procedure ) {
			return Procedure.structures.loop.call( this, null, condition, procedure );
		},
		'for': function ( expr, procedure ) {
			var	initialization = expr[0], condition = expr[1], iteration = expr[2];
			return Procedure.structures.loop.call( this, initialization, condition, [ procedure, iteration ] );
		},
		'do': function () {
			var args = [ null, null, input[0] ];
			input[1] === 'while' && args.push( input[2] );
			return Procedure.structures.loop.apply( this, args );
		},
		'try': function () {
			var args = [ input[0] ];
			input[1] === 'catch' && args.push( input[2] );
			return Procedure.structures.exception.apply( this, args );
		}
	}
});
