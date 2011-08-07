( function ( undefined ) {

module( "Deferral" );

asyncTest( "then()", function () {
	var result,
		map = { yes: 'affirm', no: 'negate', maybe: 'punt', unanswerable: 'reject' },
		d1 = new Deferral( map ),
		d2 = new Deferral( map );
	
	function setResult ( value ) {
		return function () { result = value; };
	}
	
	d1
		.then( setResult( true ), setResult( false ), setResult( null ), setResult( undefined ) )
		.always( function () {
			ok( result === null, "punted, result === null" );
			equal( d1.resolution(), 'maybe', "Resolved to 'maybe'" );
		});
	d2
		.then( setResult( true ), setResult( false ), setResult( null ), setResult( undefined ) )
		.always( function () {
			ok( result === undefined, "rejected, result === undefined" );
			equal( d2.resolution(), 'unanswerable', "Resolved to 'unanswerable'" );
		});
	
	setTimeout( function () { d1.punt(); }, 50 );
	setTimeout( function () { d2.reject(); }, 75 );
	setTimeout( start, 100 );
});

asyncTest( "promise()", function () {
	var d = new Deferral,
		p1 = d.promise(),
		p2 = p1.promise();
	ok( p1.serves( d ), "deferral.promise().serves( deferral )" );
	ok( p2.serves( d ), "deferral.promise().promise().serves( deferral )" );
	ok( Promise.resembles( { then: function () {}, promise: function () {} } ), "Promise.resembles generic promise-like object" );
	ok( Promise.resembles( jQuery.Deferred() ), "Promise.resembles jQuery.Deferred()" );
	ok( Promise.resembles( jQuery.Deferred().promise() ), "Promise.resembles jQuery.Deferred().promise()" );
	ok( !p1.isResolved() && !p2.isResolved(), "initially unresolved" );
	ok( ( d.affirm(), p1.isResolved() && p2.isAffirmed() && !p1.isNegated() ), "deferral.affirm reflected in promises" )
	start();
});

asyncTest( "when(), all affirmed", function () {
	var	result, aside,
		d1 = new Deferral(),
		d2 = new Deferral();
		d3 = new Deferral();
	
	function setResultTrue () {
		result = true;
	}
	function setResultFalse () {
		result = false;
	}
	function setAsideTrue() {
		aside = true;
	}
	
	when( d1, d2, d3 )
		.then( setResultTrue, setResultFalse )
		.then( setAsideTrue )
		.always(
			function () {
				ok( result === true && aside === true, "result === true, aside === true" );
				ok( result !== false, "result !== false" );
				ok( result != null, "result != null")
			}
		)
		.always( start );
	
	setTimeout( function () {
		d1.affirm();
	}, 25 );
	
	setTimeout( function () {
		d2.affirm();
	}, 50 );
	
	setTimeout( function () {
		d3.affirm();
	}, 75 );
});

asyncTest( "when(), early negation", function () {
	var	result, aside,
		d1 = new Deferral(),
		d2 = new Deferral();
	
	function setResultTrue () {
		result = true;
	}
	function setResultFalse () {
		result = false;
	}
	function setAsideTrue() {
		aside = true;
	}

	when( d1, d2 )
		.then( [ setResultTrue, setAsideTrue ], setResultFalse )
		.always(
			function () {
				ok( result !== true, "result !== true" );
				ok( result === false, "result === false" );
				ok( result != null, "result != null")
			},
			start
		);
	
	setTimeout( function () {
		d1.negate();
	}, 25 );
	
	setTimeout( function () {
		d2.affirm();
	}, 50 );
});

// d(x)
// .pipe( fn1(x){} )
// .pipe( fn2(x){} )
// .pipe( fn3(x){} )
// .affirm( x=42 )
// 
// d( d(fn1).then( d(fn2).then( d(fn3) ) ) ).affirm( x )

asyncTest( "pipe", function () {
	var deferral = new Deferral;
	deferral
		.pipe( function ( value ) {
			equal( value, 3 );
			var d = new Deferral;
			setTimeout( function () {
				console.log( value );
				d.affirm( null, [4] );
			}, 600 );
			return d.promise();
		})
		.always( start )
		.pipe( function ( value ) {
			console.log( value );
			// equal( value, 4 );
			return 2;
		})
	;
	deferral.affirm( null, [3] );
	// start();
});


/*
 * This test runs a set of arguments (an Array vector [ 1, 7, -5 ]) through an `OperationQueue`.
 * Each operation in the sequence will process the argument set and return a new vector, which is
 * then provided to the next operation using continuation passing style. The `OperationQueue`
 * object exposes a `promise` method that returns a `Promise` to an internal `Deferral`, which
 * will be resolved once all the operations have finished and the queue is empty.
 * 
 * Functions supplied as operations may be synchronous, directly returning the array of arguments
 * to be passed; or they may be asynchronous, returning a `Promise` to a `Deferral` that is
 * `affirm`ed once it's ready.
 * 
 * Synchronous operations can be faster since they continue immediately, however they also incur an
 * ever increasing memory overhead as they are strung together, since immediate continuations will
 * accumulate on the stack, and JavaScript does not do any tail-call optimization. Also, because
 * contiguous synchronous operations are processed within a single turn of the event loop, too long
 * a sequence may result in noticeable interruptions in the UI and elsewhere.
 * 
 * Asynchronous operations advance the queue no faster than the runtime's event loop, but this has
 * the advantage of not polluting the stack or retarding the event loop.
 * 
 * Synchronous and asynchronous operations can be mixed together arbitrarily to provide built-in
 * granular control over this balance of immediacy versus stack space.
 */
asyncTest( "OperationQueue", function () {
	var opQueue = new OperationQueue([
		
		// First, some async functions, which employ a Deferral and return a Promise
		function () {
			var	args = Array.prototype.slice.call( arguments ),
				deferral = new Deferral;
			setTimeout( function () {
				$.each( args, function ( i, value ) { args[i] = value + 1; } );
				equal( args.join(), '2,8,-4', "first op: + [1,1,1]" );
				deferral.affirm( opQueue, args );
			}, 80 );
			return deferral.promise();
		},
		function () {
			var	args = Array.prototype.slice.call( arguments ),
				deferral = new Deferral;
			setTimeout( function () {
				$.each( args, function ( i, value ) { args[i] = value / 2; } );
				equal( args.join(), '1,4,-2', "second op: * 0.5" );
				deferral.affirm( opQueue, args );
			}, 200 );
			return deferral.promise();
		},
		function () {
			var	args = Array.prototype.slice.call( arguments ),
				deferral = new Deferral;
			setTimeout( function () {
				$.each( args, function ( i, value ) { args[i] = value - 1; } );
				equal( args.join(), '0,3,-3', "third op: - [1,1,1]" );
				deferral.affirm( opQueue, args );
			}, 120 );
			return deferral.promise();
		},
		
		// Next, some synchronous functions that return `args` directly for immediate continuation
		function () {
			var	args = Array.prototype.slice.call( arguments );
			$.each( args, function ( i, value ) { args[i] = value * 2; } );
			equal( args.join(), '0,6,-6', "fourth op: * 2" );
			return args;
		},
		function () {
			var	args = Array.prototype.slice.call( arguments );
			args[0] += 1, args[1] += 3, args[2] += 10;
			equal( args.join(), '1,9,4', "fifth op: + [1,3,10]" );
			return args;
		},
		function () {
			var	args = Array.prototype.slice.call( arguments );
			$.each( args, function ( i, value ) { args[i] = Math.sqrt( value ); } );
			equal( args.join(), '1,3,2', "sixth op: sqrt" );
			return args;
		},
		
		// Since JS has no tail-call optimization, synchronous operations consume stack space. (Set a
		// breakpoint inside each of the last few operations and notice the references to `continuation`
		// accumulating.) So let's go back to using async operations, which allows the event loop to turn,
		// thereby relieving the pressure.
		function () {
			var	args = Array.prototype.slice.call( arguments ),
				deferral = new Deferral;
			setTimeout( function () {
				$.each( args, function ( i, value ) { args[i] = value - 1; } );
				equal( args.join(), '0,2,1', "seventh op: - [1,1,1]" );
				deferral.affirm( opQueue, args );
			}, 0 );
			return deferral.promise();
		},
		function () {
			var	args = Array.prototype.slice.call( arguments ),
				deferral = new Deferral;
			setTimeout( function () {
				$.each( args, function ( i, value ) { args[i] = value * 2; } );
				equal( args.join(), '0,4,2', "eighth op: * 2" );
				deferral.affirm( opQueue, args );
			}, 1000 );
			return deferral.promise();
		}
		
		// etc.
	]);
	
	/*
	 * With the operations in place, we can now simply feed the queue a set of initial values, and await
	 * its final result.
	 */
	opQueue
		.start( 1, 7, -5 )
		.promise()
			.then( function ( x, y, z ) {
				equal( Array.prototype.slice.call( arguments ).join(), '0,4,2', "Complete" );
				
				// The queue has been emptied and stopped, but on the next frame we can make use of it again
				setTimeout( function () {
					opQueue.push(
						function () {
							var args = Array.prototype.slice.call( arguments );
							$.each( args, function ( i, value ) { args[i] += 1; } );
							equal( args.join(), '1,5,3', "first op of second run: + [1,1,1]" );
							return args;
						},
						function ( x, y, z ) {
							var result = [ x*x, y*y, z*z ];
							equal( result.join(), '1,25,9', "second op: Math.square" );
							return result;
						}
					);
					ok( opQueue.length == 2, "Second run prepared" );
					opQueue
						.start( x, y, z ) // [0, 4, 2]
						.promise()
							.then( function ( x, y, z ) {
								equal( Array.prototype.slice.call( arguments ).join(), '1,25,9', "Second run complete" );
							})
							.always( start )
					;
				}, 0 );
			})
	;
	
	/*
	 * But before we set it completely loose, let's suspend the queue after it's 100 ms along; this
	 * should occur during the second operation, so the queue will pause after that completes in another
	 * 20 ms, and then be ready to resume with the third operation when we call `resume` 180 ms later.
	 */
	setTimeout( function () {
		opQueue.pause();
		equal( opQueue.args().join(), '2,8,-4', "Intermediate value when pause command is issued" );
	}, 100 );
	setTimeout( function () {
		equal( opQueue.args().join(), '1,4,-2', "Intermediate value after queue is actually suspended" );
		opQueue.resume();
	}, 300 );
	
});

})();