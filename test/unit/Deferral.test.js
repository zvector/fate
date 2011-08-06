( function ( undefined ) {

module( "Deferral" );

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


asyncTest( "OperationQueue", function () {
	var opQueue = new OperationQueue([
		// a list of functions that return a promise
		function () {
			var	args = Array.prototype.slice.call( arguments ),
				deferral = new Deferral;
			setTimeout( function () {
				equal( args.join(), '1,7,-5', "first op: + [1,1,1]" );
				$.each( args, function ( i, value ) { args[i] = value + 1; } );
				deferral.affirm( opQueue, args );
			}, 80 );
			return deferral.promise();
		},
		function () {
			var	args = Array.prototype.slice.call( arguments ),
				deferral = new Deferral;
			setTimeout( function () {
				equal( args.join(), '2,8,-4', "second op: * 0.5" );
				$.each( args, function ( i, value ) { args[i] = value / 2; } );
				deferral.affirm( opQueue, args );
			}, 40 );
			return deferral.promise();
		},
		function () {
			var	args = Array.prototype.slice.call( arguments ),
				deferral = new Deferral;
			setTimeout( function () {
				equal( args.join(), '1,4,-2', "third op: - [1,1,1]" );
				$.each( args, function ( i, value ) { args[i] = value - 1; } );
				deferral.affirm( opQueue, args );
			}, 20 );
			return deferral.promise();
		},
		function () {
			var	args = Array.prototype.slice.call( arguments ),
				deferral = new Deferral;
			setTimeout( function () {
				equal( args.join(), '0,3,-3', "fourth op: * 2" );
				$.each( args, function ( i, value ) { args[i] = value * 2; } );
				deferral.affirm( opQueue, args );
			}, 10 );
			return deferral.promise();
		},
		function () {
			var	args = Array.prototype.slice.call( arguments ),
				deferral = new Deferral;
			setTimeout( function () {
				equal( args.join(), '0,6,-6', "fifth op: + [1,3,10]" );
				args[0] += 1, args[1] += 3, args[2] += 10;
				deferral.affirm( opQueue, args );
			}, 80 );
			return deferral.promise();
		},
		function () {
			var	args = Array.prototype.slice.call( arguments ),
				deferral = new Deferral;
			setTimeout( function () {
				equal( args.join(), '1,9,4', "sixth op: sqrt" );
				$.each( args, function ( i, value ) { args[i] = Math.sqrt( value ); } );
				deferral.affirm( opQueue, args );
			}, 40 );
			return deferral.promise();
		},
		function () {
			var	args = Array.prototype.slice.call( arguments ),
				deferral = new Deferral;
			setTimeout( function () {
				equal( args.join(), '1,3,2', "seventh op: - [1,1,1]" );
				$.each( args, function ( i, value ) { args[i] = value - 1; } );
				deferral.affirm( opQueue, args );
			}, 20 );
			return deferral.promise();
		},
		function () {
			var	args = Array.prototype.slice.call( arguments ),
				deferral = new Deferral;
			setTimeout( function () {
				equal( args.join(), '0,2,1', "eighth op: * 2" );
				$.each( args, function ( i, value ) { args[i] = value * 2; } );
				deferral.affirm( opQueue, args );
			}, 10 );
			return deferral.promise();
		}
		// ...
	]);

	opQueue
		.start( 1, 7, -5 )
		.then( function ( x, y, z ) {
			equal( Array.prototype.slice.call( arguments ).join(), '0,4,2', "complete" );
		})
		.always( start );
});

})();