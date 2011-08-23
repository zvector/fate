( function ( undefined ) {

module( "Procedure" );

asyncTest( "Nesting Pipeline/when", 8, function () {
	var	number = 0,
		time = ( new Date ).getTime();
	
	function fn ( n ) {
		return function () {
			var deferral = Deferral();
			setTimeout( function () {
				deferral[ n === ++number ? 'affirm' : 'negate' ]
					( 'fn(' + n + ') @ t=' + ( ( new Date ).getTime() - time ) );
			}, 10 );
			return deferral.then(
				function ( message ) {
					ok( true, message );
				},
				function ( message ) {
					ok( false, message );
				}
			);
		};
	}
	
	function parallel () {
		var args = Array.prototype.slice.call( arguments );
		return function () {
			for ( var i = 0, l = args.length; i < l; i++ ) {
				args[i] = args[i]();
			}
			return Deferral.when( args );
		};
	}
	function series () {
		var args = Array.prototype.slice.call( arguments );
		return function () {
			return Pipeline( args ).start( arguments ).promise();
		};
	}
	
	series(
		fn(1),
		parallel(
			fn(2),
			series( fn(3), fn(6) ),
			parallel( fn(4), fn(5) )
		),
		series( fn(7), fn(8) )
	)()
		.then( start );
});

asyncTest( "Using serial/parallel literals", 22, function () {
	var number = 0,
		time = ( new Date ).getTime();
	
	function fn ( n ) {
		return function () {
			var deferral = Deferral();
			setTimeout( function () {
				deferral[ n === ++number ? 'affirm' : 'negate' ]
					( 'fn(' + n + ') @ t=' + ( ( new Date ).getTime() - time ) );
			}, 10 );
			return deferral.then(
				function ( message ) {
					ok( true, message );
				},
				function ( message ) {
					ok( false, message );
				}
			);
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
		.always( start );
	
	// Tick sequence:
	// 1
	// 2 3 4 5 6 7 8 9 10
	// 11 12 13 14 15 16
	// 17
	// 18
	// 19
	// 20
	// 21
	// 22
});

asyncTest( "Using multiplex literals", 22, function () {
	var number = 0,
		time = ( new Date ).getTime();
	
	function fn ( n ) {
		return function () {
			var deferral = Deferral();
			setTimeout( function () {
				deferral[ n === ++number ? 'affirm' : 'negate' ]
					( 'fn(' + n + ') @ t=' + ( ( new Date ).getTime() - time ) );
			}, 10 );
			return deferral.then(
				function ( message ) {
					ok( true, message );
				},
				function ( message ) {
					ok( false, message );
				}
			);
		};
	}
	
	Procedure([
		fn(1),
		[[
			fn(2),
			{ 2:[
				fn(3),
				fn(4),
				[
					fn(6),
					[[
						fn(9),
						fn(10),
						[[ fn(11), fn(12) ]]
					]],
					fn(15),
					[
						fn(17),
						fn(19)
					]
				],
				fn(7),
				[[
					fn(13),
					[ fn(14), fn(16) ]
				]],
				fn(18)
			]},
			[ fn(5), fn(8) ]
		]],
		[ fn(20), fn(21) ],
		fn(22)
	])
		.start()
		.always( start );
	
	// Tick sequence:
	// 1
	// 2 3 4 5
	// 6 7 8
	// 9 10 11 12 13 14
	// 15 16
	// 17 18
	// 19
	// 20
	// 21
	// 22
});

asyncTest( "Mixing in jQuery promises", 4, function () {
	Procedure( [[
		function () {
			// console.log("1");
			ok( true );
			return Deferral.Nullary();
		},
		[
			function () {
				return jQuery.ajax( '/', {} )
					.then(
						function () {
							// console.log("2");
						},
						function () {
							console.log("failed");
						}
					)
					.always( function () {
						ok( true );
					});
			},
			function () {
				return jQuery.ajax( '/', {} )
					.then(
						function () {
							// console.log("3")
						},
						function () {
							console.log("failed");
						}
					)
					.always( function () {
						ok( true );
					});
			}
		],
		function () {
			// console.log("4");
			ok( true );
			return Deferral.Nullary();
		}
	]] )
		.start()
		.then( start );
});

})();