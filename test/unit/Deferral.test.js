( function ( undefined ) {

module( "Deferral ( when then always succeed forfeit )" );

asyncTest( "when( multiple deferrals ), all succeed", function () {
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
		d1.fulfill();
	}, 25 );
	
	setTimeout( function () {
		d2.fulfill();
	}, 50 );
	
	setTimeout( function () {
		d3.fulfill();
	}, 75 );
});

asyncTest( "when( multiple deferrals ), early forfeit", function () {
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
		d1.forfeit();
	}, 25 );
	
	setTimeout( function () {
		d2.fulfill();
	}, 50 );
});

})();