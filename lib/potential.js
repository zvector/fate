// Potential takes an input object in json and uses that to create a tree of States.
( Potential.prototype = Object.create( State.prototype ) ).constructor = Potential;
function Potential ( data ) {
	this.substates = Potential.parse( this, data );
}
Potential.parse = function ( superstate, input ) {
	var key, value, output = {}, state;
	for ( key in input ) if ( Z.hasOwn( input, key ) ) {
		value = input[ key ];
		output[ key ] =
			Z.type( value ) === 'string' ?
				new State( superstate, key, value ) :
			Z.isPlainObject( value ) ?
				Z.extend( state = new State( superstate, key ), { substates: Potential.parse( state, value ) } ) :
			Z.isArray( value ) ?
				Z.extend( state = new State( superstate, key, value[0] ), { substates: Potential.parse( state, value[1] ) } ) :
			new State( superstate, key );
	}
	return output;
};
