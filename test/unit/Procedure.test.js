( function ( undefined ) {

module( "Procedure" );

asyncTest( "Nesting Queue/when", 8, function () {
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
			return when( args );
		};
	}
	function series () {
		var args = Array.prototype.slice.call( arguments );
		return function () {
			return Queue( args ).start( arguments ).promise();
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

asyncTest( "Procedure", 22, function () {
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
});

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

})();