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
		deferral = ( new Deferral ).as( scope || ( scope = {} ) ),
		procedure = parse.call( scope, input );
	
	function downscope ( from ) {
		// TODO: shim for Object.create
		return Object.create( from || scope || null, { __procedure__: self } );
	}
	
	function parse ( obj, index, container ) {
		var statement, label, fn, array, keys, i, l, width;
		
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
			
			// Control block
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
			&& ( keys = Z.keys( obj ) ).length === 1
			&& Z.isNumber( width = Math.round( +keys[0] ) )
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
			deferral.as( context );
			return self;
		},
		given: function ( args ) {
			deferral.given( args );
			return self;
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

function ExecutionDeferral () {
	if ( !( this instanceof ExecutionDeferral ) ) { return new ExecutionDeferral; }
	Deferral.call( this, { ok: 'proceed', error: 'throw' } );
}
ExecutionDeferral.prototype = Deferral.prototype;

Z.extend( true, Procedure, {
	structures: {
		series: function () {
			var	pipeline = Pipeline( Z.slice.call( arguments ) ).as( this );
			return function () {
				return pipeline.given( arguments ).start().promise();
			};
		},
	
		parallel: function () {
			var	scope = this,
				promises = Z.slice.call( arguments );
			return function () {
				for ( var obj, i = 0, l = promises.length; i < l; i++ ) {
					obj = promises[i].apply( scope, arguments );
					if ( !( Z.isFunction( obj ) || Promise.resembles( obj ) ) ) {
						obj = Deferral.Nullary( scope, obj );
					}
					promises[i] = obj;
				}
				return Deferral.when( promises );
			};
		},
	
		multiplex: function ( width, operations ) {
			var multiplex = Multiplex( width, operations ).as( this );
			return function () {
				return multiplex.given( arguments ).start().promise();
			};
		},
	
		branch: function ( condition, potential ) {
			var	scope = this,
				execution = ( new ExecutionDeferral ).as( scope );
			
			return function () {
				
				// If `condition` is a function, treat it like a closure over the actual object of interest
				Z.isFunction( condition ) && ( condition = condition.apply( scope, arguments ) );
				
				return condition = (
					Promise.resembles( condition ) ? condition :
					Z.isArray( condition ) ? Procedure( condition, scope ).given( arguments ).start() :
					( new Deferral ).as( scope ).given( arguments )[ condition ? 'affirm' : 'negate' ]()
				)
					.promise()
					
					// After the condition is resolved, match its resolution with the corresponding value in
					// `potential`, evaluate that as a new Procedure, and use its result to resolve `execution`.
					.always( function () {
						var	resolution = condition.resolution().split('.'),
							i = 0, l = resolution.length, block;
						
						// Identify the entry within `potential` that corresponds to the resolution of
						// `condition`, and use that to create a procedural block.
						while ( i < l ) {
							block = potential[ resolution[ i++ ] ];
						}
						Z.isPlainObject( block ) && ( block = block[''] );
						block = Procedure( block, scope );
						
						// Arrange for the block to be executed once `condition` is resolved.
						condition.register( resolution, function () {
							return block
								.given( arguments )
								.start()
								.promise()
								.then( execution.proceed, execution.throw )
							;
						});
					});
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
		'do': function () {
			var	argsIn = Z.slice.call( arguments ),
				argsOut = [ null, null, argsIn[0] ];
			argsIn[1] === 'while' && argsOut.push( argsIn[2] );
			return Procedure.structures.loop.apply( this, argsOut );
		},
		'while': function ( condition, procedure ) {
			return Procedure.structures.loop.call( this, null, condition, procedure );
		},
		'for': function ( expr, procedure ) {
			var	initialization = expr[0], condition = expr[1], iteration = expr[2];
			return Procedure.structures.loop.call( this, initialization, condition, [ procedure, iteration ] );
		},
		'try': function () {
			var	argsIn = Z.slice.call( arguments ),
				argsOut = [ argsIn[0] ];
			argsIn[1] === 'catch' && argsOut.push( argsIn[2] );
			return Procedure.structures.exception.apply( this, argsOut );
		}
	}
});
