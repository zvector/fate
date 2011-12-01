( function ( undefined ) {

module( "State" );

var	Deferral = Fate.Deferral,
	State = Deferral.State;

1&&
asyncTest( "State", function () {
	var	root = new State({
			a: null,
			b: {
				c: null,
				d: null
			}
		}),
		a = root.substate('a'),
		b = root.substate('b'),
		c = root.substate('b.c'),
		d = root.substate('b.d');
	
	ok( a instanceof State && Z.isFunction( a.name ) );
	ok( b instanceof State && Z.isFunction( b.name ) );
	ok( c instanceof State && Z.isFunction( c.name ) );
	ok( d instanceof State && Z.isFunction( d.name ) );
	
	start();
});

})();