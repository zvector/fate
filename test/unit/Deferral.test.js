( function ( undefined ) {

module( "Deferral" );

asyncTest( "Deferral", function () {
	var d = new Deferral( function ( a, b, c ) {
		this.then( function ( x, y, z ) {
				ok( a === x && b === y && c === z );
				ok( a === 1 && b === 2 && c === 3 );
			})
			.affirm( a, b, c );
	}, [ 1, 2, 3 ] );
	ok( d.did('affirm') );
	start();
});

asyncTest( "Nullary Deferral", function () {
	var	context = {},
		d = Deferral.Nullary( context, [ 1, 2, 3 ] );
	strictEqual( d.did(), true );
	strictEqual( d.resolution(), true );
	ok( d.promise() );
	strictEqual( d.did(), d.promise().did() );
	strictEqual( d.resolution(), d.promise().resolution() );
	ok( d.as() === d );
	d.promise().then( function ( a, b, c ) {
		ok( this === context && a === 1 && b === 2 && c === 3 );
	});
	start();
});

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
	ok( p1 === p2, "deferral.promise() === deferral.promise().promise()" );
	ok( Promise.resembles( { then: function () {}, promise: function () {} } ), "Promise.resembles generic promise-like object" );
	ok( Promise.resembles( jQuery.Deferred() ), "Promise.resembles jQuery.Deferred()" );
	ok( Promise.resembles( jQuery.Deferred().promise() ), "Promise.resembles jQuery.Deferred().promise()" );
	ok( !p1.resolution() && !p2.resolution(), "initially unresolved" );
	d.affirm();
	ok( p1.resolution() && p2.did('affirm') && p2.resolution('yes') && !p1.resolution('no') && !p1.did('negate'), "deferral.affirm reflected in promises" );
	start();
});


asyncTest( "when()", function () {
	var	d1 = new Deferral,
		d2 = new Deferral,
		p2 = d2.promise(),
		w,
		result; d1['']='d1',d2['']='d2',p2['']='p2';
	
	function setResult ( value ) {
		return function () {
			result = value;
			// console.log( result );
		}
	}
	
	( w = when(
		when( d1 ).then( setResult( d1 ) ),
		when( p2 ).then( setResult( p2 ) )
	) )
		// .then( function () { console.log( w ); } )
		.then( start ); w['']='w';
	
	setTimeout( function () {
		d1.affirm();
		equal( result, d1, "when( Deferral )" );
	}, 200 );
	
	setTimeout( function () {
		d2.affirm();
		equal( result, p2, "when( Promise )" );
	}, 400 );
});

asyncTest( "when(), all affirmed", function () {
	var	a, b,
		likeDojo = { addCallback: 'callback', addErrback: 'errback' },
		likeJQuery = { done: 'resolve', fail: 'reject' },
		d1 = new Deferral,
		d2 = new Deferral( likeDojo ),
		d3 = new Deferral( likeJQuery );
	
	function setA ( value ) {
		return function () {
			a = value;
		}
	}
	function setB ( value ) {
		return function () {
			b = value;
		}
	}
	function doTests () {
		ok( a === true, "a === true" );
		ok( b === true, "b === true" );
	}
	
	when( d1.promise(), d2.promise(), d3.promise() )
		.then( setA( true ), setA( false ) )
		.then( setB( true ) )
		.always( doTests, start );
	
	setTimeout( function () {
		d1.affirm();
	}, 25 );
	
	setTimeout( function () {
		d2.callback();
	}, 50 );
	
	setTimeout( function () {
		d3.resolve();
	}, 75 );
});

asyncTest( "when(), early negation", function () {
	var	a, b,
		d1 = new Deferral,
		d2 = new Deferral;
	
	function setA ( value ) {
		return function () {
			a = value;
		}
	}
	function setB ( value ) {
		return function () {
			b = value;
		}
	}
	function doTests () {
		ok( a === false, "a === false" );
		ok( b === undefined, "b === undefined" );
	}

	when( d1, d2, 'yes' )
		.then( [ setA( true ), setB( true ) ], setA( false ) )
		.always( doTests, start );
	
	setTimeout( function () {
		d1.negate();
	}, 25 );
	
	setTimeout( function () {
		d2.affirm();
	}, 50 );
});


asyncTest( "pipe", function () {
	var deferral = new Deferral;
	deferral
		.pipe( function ( value ) {
			equal( value, 3 );
			var d = new Deferral;
			setTimeout( function () { d.affirm( 4 ); }, 60 );
			return d.promise();
		})
		.pipe( function ( value ) {
			equal( value, 4 );
			return 2;
		})
		.pipe( function ( value ) {
			equal( value, 2 );
			var d = new Deferral;
			setTimeout( function () { d.affirm( 5 ); }, 40 );
			return d.promise();
		})
		.pipe( function ( value ) {
			equal( value, 5 );
			return 6;
		})
		.pipe( function ( value ) {
			equal( value, 6 );
			var d = new Deferral;
			setTimeout( function () { d.affirm( 8 ); }, 70 );
			return d.promise();
		})
		.pipe( function ( value ) {
			equal( value, 8 );
			return 7;
		})
		.pipe( function ( value ) {
			equal( value, 7 );
			var d = new Deferral;
			setTimeout( function () { d.affirm( 1 ); }, 30 );
			return d.promise();
		})
		.pipe( function ( value ) {
			equal( value, 1 );
			return 9;
		})
		.pipe( function ( value ) {
			equal( value, 9 );
		})
		.then( start )
	;
	deferral.affirm( 3 );
});


/*
 * This test runs a set of arguments (an Array vector [ 1, 7, -5 ]) through a `Queue`.
 * Each operation in the sequence will process the argument set and return a new vector, which is
 * then provided to the next operation using continuation passing style. The `Queue`
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
asyncTest( "Queue", function () {
	
	function async ( fn, delay, test ) {
		return function () {
			var args = fn.apply( this, arguments ),
				deferral = Deferral().as( queue ).given( args );
			setTimeout( function () {
				equal( args.join(), test );
				deferral.affirm();
			}, delay );
			return deferral.promise();
		};
	}
	
	function sync( fn, test ) {
		return function () {
			var args = fn.apply( this, arguments );
			equal( args.join(), test );
			return args;
		};
	}
	
	var queue = new Queue([
		// First, some async functions, which employ a Deferral and return a Promise
		async( function ( x, y, z ) { return [ x+1, y+1, z+1 ]; }, 80, '2,8,-4' ),
		async( function ( x, y, z ) { return [ x/2, y/2, z/2 ]; }, 200, '1,4,-2' ),
		async( function ( x, y, z ) { return [ x-1, y-1, z-1 ]; }, 120, '0,3,-3' ),
		
		// Next, some synchronous functions that return `args` directly for immediate continuation
		sync( function ( x, y, z ) { return [ x*2, y*2, z*2 ]; }, '0,6,-6' ),
		sync( function ( x, y, z ) { return [ x+1, y+3, z+10 ]; }, '1,9,4' ),
		sync( function ( x, y, z ) { return [ Math.sqrt(x), Math.sqrt(y), Math.sqrt(z) ] }, '1,3,2' ),
		
		// Since JS isn't tail-call optimized, synchronous operations accumulate on the stack. (Set a
		// breakpoint inside each of the last few operations and notice the growing number of references to
		// `continuation`.) To relieve that pressure, let's go back to using async operations, which
		// allows the event loop to turn over and the call stack to unwind.
		async( function ( x, y, z ) { return [ x-1, y-1, z-1 ] }, 0, '0,2,1' ),
		async( function ( x, y, z ) { return [ x*2, y*2, z*2 ] }, 100, '0,4,2' )
	]);
	
	/*
	 * With the operations in place, we can now simply feed the queue a set of initial values, and await
	 * its final result.
	 */
	queue.start( 1, 7, -5 ).promise()
		.then( function () {
			equal( Array.prototype.slice.call( arguments ).join(), '0,4,2', "Complete" );
		})
		
		/**
		 * But wait there's more ... the queue has been emptied and stopped, but on the next frame
		 * we can make use of it again.
		 */
		.then( encore )
		
		// And now we've finally reached the end, so we're ready to set loose the async tester.
		.then( start )
	;
	
	function encore ( x, y, z ) {
		setTimeout( function () {
			queue.push(
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
			ok( queue.length == 2, "Second run prepared" );
			queue
				.start( x, y, z ) // [0, 4, 2], as returned from the initial run
				.promise()
					.then( function ( x, y, z ) {
						equal( Array.prototype.slice.call( arguments ).join(), '1,25,9', "Second run complete" );
					})
			;
		}, 0 );
	}
	
	/*
	 * And for good measure, let's try scheduling the queue to be suspended after it's 100 ms along; this
	 * should occur during the second operation, so the queue will pause after that completes in another
	 * 20 ms, and then be ready to resume with the third operation when we call `resume` 180 ms later.
	 */
	setTimeout( function () {
		queue.pause();
		equal( queue.args().join(), '2,8,-4', "Intermediate value when pause command is issued" );
	}, 100 );
	setTimeout( function () {
		equal( queue.args().join(), '1,4,-2', "Intermediate value after queue is actually suspended" );
		queue.resume();
	}, 300 );
});

asyncTest( "Nesting Queue/when", function () {
	var	number = 0,
		time = ( new Date ).getTime();
	
	function fn ( n ) {
		return function () {
			var d = new Deferral.Unary;
			setTimeout( function () {
				// console.log( n + ": " + ( ( new Date ).getTime() - time ) );
				ok( n === ++number, n );
				d.resolve();
			}, 100 );
			return d.promise();
		};
	}
	
	function parallel () {
		var args = Array.prototype.slice.call( arguments );
		return function () {
			for ( var i = 0, l = args.length; i < l; i++ ) { args[i] = args[i](); }
			return when( args );
		};
	}
	function series () {
		var args = Array.prototype.slice.call( arguments );
		return function () { return Queue( args ).start( arguments ).promise(); };
	}
	
	series(
		fn(1),
		parallel(
			fn(2),
			parallel( fn(3), fn(4) ),
			series( fn(5), fn(6) )
		),
		series( fn(7), fn(8) )
	)()
		.then( start );
});

asyncTest( "Procedure", function () {
	var number = 0,
		time = ( new Date ).getTime();
	
	function fn ( n ) {
		return function () {
			var d = new Deferral.Unary;
			setTimeout( function () {
				// console.log( n + ": " + ( ( new Date ).getTime() - time ) );
				ok( n === ++number, n );
				d.resolve();
			}, 100 );
			return d.promise();
		};
	}
	
	Procedure([
		fn(1),
		[[
			fn(2),
			[[
				fn(3),
				fn(4),
				[
					fn(5),
					[[
						fn(11),
						fn(12),
						[[ fn(13), fn(14) ]]
					]],
					fn(17),
					[
						fn(18),
						fn(19)
					]
				],
				fn(6),
				[[
					fn(7),
					[ fn(8), fn(15) ]
				]],
				fn(9)
			]],
			[ fn(10), fn(16) ]
		]],
		[ fn(20), fn(21) ],
		fn(22)
	])
		.start()
		.then( start );
});

})();

asyncTest( "Mixing in jQuery promises", function () {
	Procedure( [[
		function () {
			console.log("1");
			ok( true );
			return Deferral.Nullary();
		},
		[
			function () {
				return jQuery.ajax( '/', {} )
					.then( function () { console.log("2") }, function () { console.log("failed"); } )
					.always( function () { ok( true ); } );
			},
			function () {
				return jQuery.ajax( '/', {} )
					.then( function () { console.log("3") }, function () { console.log("failed"); } )
					.always( function () { ok( true ); } );
			}
		],
		function () {
			console.log("4");
			ok( true );
			return Deferral.Nullary();
		}
	]] )
		.start()
		.then( start );
});