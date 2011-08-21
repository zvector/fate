( function ( undefined ) {

module( "Pipeline" );

/*
 * This test runs a set of arguments (an Array vector [ 1, 7, -5 ]) through a `Pipeline`.
 * Each operation in the sequence will process the argument set and return a new vector, which is
 * then provided to the next operation using continuation passing style. The `Pipeline`
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
asyncTest( "Pipeline", function () {
	
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
	
	var queue = new Pipeline([
		// First, some async functions, which employ a Deferral and return a Promise
		async( function ( x, y, z ) { return [ x+1, y+1, z+1 ]; }, 80, '2,8,-4' ),
		async( function ( x, y, z ) { return [ x/2, y/2, z/2 ]; }, 200, '1,4,-2' ),
		async( function ( x, y, z ) { return [ x-1, y-1, z-1 ]; }, 120, '0,3,-3' ),
		
		// Next, some synchronous functions that return `args` directly, for immediate continuation
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
		
		// And now we've finally reached the end, so we're ready to set loose the async testrunner.
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

})();