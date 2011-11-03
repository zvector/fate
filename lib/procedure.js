/**
 * A **procedure** defines an execution flow by nesting multiple parallel and serial function arrays.
 * 
 * Input is accepted in the form of nested function arrays, of arbitrary depth, where an array
 * literal `[ ]` represents a group of functions to be executed in a serial queue using a `Pipeline`;
 * a **double array literal** `[[ ]]` represents a group of functions to be executed as a parallel
 * set using a `join` operation; a **numerically-keyed object–bound array literal** `{n:[ ]}`
 * represents a group of functions to be executed in parallel, up to `n` items concurrently, using a
 * `Multiplex` of width `n`; and a **block literal** `['type', ... ]` represents a control structure,
 * where `type` may be a statement such as `if`, `while`, `for`, etc., any of which direct the flow
 * of asynchronous execution in a manner analogous to their respective language-level counterparts.
 */

// Z.oo( Procedure ).inherit( Future ).implement( Foo, Bar );
	
function Procedure ( input, name, scope ) {
	if ( !( this instanceof Procedure ) ) {
		return new Procedure( input, name, scope );
	}
	
	var	self = this,
		deferral = ( new Deferral ).as( scope || ( scope = {} ) );
	
	function subscope ( superscope ) {
		return Z.create( superscope || scope || null, { __procedure__: self } );
	}
	
	function interpret ( obj, index, container ) {
		var	type = Z.type( obj ),
			identifier, label, fn, array, keys, i, l, width;
		
		if ( type === 'function' ) {
			return obj;
		}
		
		else if ( type === 'string' ) {
			
			// Reserved word; interpret as a control statement: `return` | `yield` | `break` | `continue`
				// `return` issues `stop()` on `this.__procedure__` and resolves the procedure deferral
				// `yield` issues `pause()` on `this.__procedure__` without resolving the procedure deferral
				// `break` issues `stop()` on `this.__block__` and resolves the block deferral
				// `continue` issues `stop()` on `this.__block__` without resolving the block deferral
			if ( obj in Procedure.statements ) {
				return Procedure.statements[ obj ].call( this, obj );
			}
			
			// Not a reserved word; interpret as a dangling string expression
			else {
				// Could add directives e.g. "use strict" here
			}
		}
		
		else if ( type === 'array' ) {
			identifier = obj[0];
			
			if ( Z.isString( identifier ) ) {
				
				// Reserved word; interpret as an identifier for a control block
				if ( identifier in Procedure.statements ) {
					return Procedure.statements[ identifier ].apply( this, obj.slice(1) );
				}
				
				// Not a reserved word; interpret as a named identifier for a procedure defined by the subsequent elements
				else {
					// TODO
					return this[ identifier ] = Procedure( obj.slice(1), identifier, subscope( this ) );
				}
			}
			
			// Simple series or parallel literal: `[ ... ]` | `[[ ... ]]`
			else {
				fn = obj.length === 1 && Z.isArray( obj[0] ) ?
					( obj = obj[0], Procedure.structures.parallel ) :
					Procedure.structures.series;
				
				for ( array = [], i = 0, l = obj.length; i < l; i++ ) {
					array.push( interpret.call( subscope( this ), obj[i], i, obj ) );
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
				array.push( interpret.call( subscope( this ), obj[i], i, obj ) );
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
			var result = interpret.call( scope, input ).apply( self, arguments );
			
			function affirm () {
				return deferral.as( result ).given( arguments ).affirm();
			}
			function negate () {
				return deferral.as( result ).given( arguments ).negate();
			}
			
			Future.resembles( result ) ?
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
			var	scope = this,
				operations = Z.slice.call( arguments );
			return function () {
				// var pipeline = Pipeline( args );
				// return pipeline.start.apply( pipeline, arguments ).promise();
				return Pipeline( operations )
					.as( scope )
					.given( arguments )
					.start()
					.promise()
				;
			};
		},
	
		parallel: function () {
			var	scope = this,
				futures = Z.slice.call( arguments );
			return function () {
				for ( var obj, i = 0, l = futures.length; i < l; i++ ) {
					obj = futures[i].apply( scope, arguments );
					if ( !( Z.isFunction( obj ) || Future.resembles( obj ) ) ) {
						obj = NullaryDeferral( scope, obj );
					}
					futures[i] = obj;
				}
				return Deferral.join( futures );
			};
		},
	
		multiplex: function ( width, operations ) {
			var scope = this;
			return function () {
				return Multiplex( width, operations )
					.as( scope )
					.given( arguments )
					.start()
					.promise()
				;
			};
		},
	
		branch: function ( condition, potential ) {
			var scope = this;
			return function () {
				var promise;
				
<<<<<<< HEAD
				// Create the enclosing deferral
				var deferral = Deferral().as( scope ).given( arguments );
				
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
=======
				// If `condition` is a function, treat it like a closure over the actual object of interest
				if ( Z.isFunction( condition ) ) {
					condition = condition.apply( scope, arguments );
				}
				
				if ( !Future.resembles( condition ) ) {
					condition = Z.isArray( condition ) ?
						Procedure( condition, null, scope ).given( arguments ).start() :
						( new Deferral ).as( scope ).given( arguments )[ condition ? 'affirm' : 'negate' ]();
				}
				
				// After the condition is resolved, match its resolution with the corresponding value in
				// `potential`, evaluate that as a new Procedure, and use its result to resolve `execution`.
				condition.always( function () {
					var	resolution = condition.resolution().split('.'),
						i = 0, l = resolution.length, block;
					
					// Identify the entry within `potential` that corresponds to the resolution of
					// `condition`, and use that to create a procedural block.
					while ( i < l ) {
						block = potential[ resolution[ i++ ] ];
					}
					Z.isPlainObject( block ) && ( block = block[''] );
					block = Procedure( block, null, scope );
					
					// Arrange for the block to be executed once `condition` is resolved.
					condition.registerTo( resolution, function () {
						return block
							.given( arguments )
							.start()
							.promise()
							.then( execution.proceed, execution.throw )
						;
					});
				});
>>>>>>> 2011-10-04-variadics
			};
		},
		
		selection: function ( condition, potential ) {
			var scope = this,
				execution = ( new ExecutionDeferral ).as( scope );
			
			return function () {
				
				// If `condition` is a function, treat it like a closure over the actual object of interest
				if ( Z.isFunction( condition ) ) {
					condition = condition.apply( scope, arguments );
				}
				
				if ( !Future.resembles( condition ) ) {
					condition = Z.isArray( condition ) ?
						Procedure( condition, null, scope ).given( arguments ).start() :
						( new Deferral ).as( scope ).given( arguments )[ condition ? 'affirm' : 'negate' ]();
				}
				
				// Apply contents of `potential` to the `condition` promise
				// By default do this late, on root state in bubble phase, to avoid overhead of creating tons of functions that won't get used
			}
		},
		
		loop: function ( initialization, precondition, procedure, postcondition ) {
		
		},
		
		iteration: function ( keyVar, valueVar, collection, procedure ) {
			
		},
		
		exception: function ( attempt, errorPotential ) {
		
		}
	},
	
	statements: {
		'if': function ( condition, predicate, elseKeyword, elseBlock ) {
			if ( Z.isPlainObject( predicate ) ) {
				return Procedure.structures.selection.call( this, condition, predicate );
			}
			
			else {
				if ( Z.isString( elseKeyword ) && elseKeyword.indexOf( 'else' ) === 0 ) {
					if ( elseKeyword === 'else if' ) {
						elseBlock = Procedure.statements['if'].apply( this, Z.slice.call( arguments, 3 ) );
					}
				} else {
					elseBlock = elseKeyword;
				}
				return Procedure.structures.branch.call( this, condition, predicate, elseBlock );
			}
			
			throw new Error( "Parse error: if" );
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
		
		// [ 'each', 'key value in foo', [
		// 	function () {
		// 		return this.foo[ this.key ] === this.value;
		// 	}
		// ] ]
		'each': function ( expr, procedure ) {
			// "key value in collection" | "key in collection" | "value of collection"
			Z.isString( expr ) && ( expr = expr.split( /\s+/ ) );
			
		},
		
		'try': function () {
			var	argsIn = Z.slice.call( arguments ),
				argsOut = [ argsIn[0] ];
			argsIn[1] === 'catch' && argsOut.push( argsIn[2] );
			return Procedure.structures.exception.apply( this, argsOut );
		}
	}
});

// An explicit `Scope` type. No other use at present than to differentiate from a plain Object.
// TODO: args `superscope`, `procedure`, `block`
function Scope () {
}

function ExecutionDeferral () {
	if ( !( this instanceof ExecutionDeferral ) ) { return new ExecutionDeferral; }
	Deferral.call( this, { ok: 'proceed', error: 'throw' } );
}
ExecutionDeferral.prototype = Deferral.prototype;
