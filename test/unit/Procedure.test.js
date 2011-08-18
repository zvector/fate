( function ( undefined ) {

module( "Procedure" );

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