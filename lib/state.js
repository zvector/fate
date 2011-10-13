// this is static/shared on the deferral prototype; it should not hold reference to any deferral instance

function State ( superstate, name ) {
	if ( !( this instanceof State ) ) {
		return Z.isPlainObject( superstate ) ?
			( new State( undefined, name ) ).addSubstates( superstate ) :
			new State( superstate, name );
	}
	
	var path;
	
	return Z.extend( this, {
		superstate: function ( value ) {
			return superstate === undefined ? ( superstate = value ) : superstate;
		},
		name: function ( value ) {
			return name === undefined ? ( name = value ) : name || '';
		},
		path: function () {
			var lineage;
			return path || name && (
					path = ( lineage = superstate && superstate.path() ) ?
						lineage + '.' + name :
						name
				) || '';
		}
	});
}
Z.extend( true, State, {
	prototype: {
		substate: function ( path ) {
			return path ? Z.lookup( this.substates, path, '.substates' ) : this;
		},
		
		root: function () {
			var superstate = this.superstate();
			return ( superstate ? superstate.root() : superstate ) || this;
		},
		
		derivation: function ( after ) {
			var cursor, result = [];
			for ( cursor = this; cursor && ( !after || cursor !== after ); cursor = cursor.superstate() ) {
				result.unshift( cursor );
			}
			return result;
		},
		
		isSuperstateOf: function ( substate ) {
			var superstate = substate.superstate();
			return superstate && ( this === superstate || this.isSuperstateOf( superstate ) );
		},
		
		addSubstate: function ( name ) {
			var constructor = this.constructor,
				state = Z.create( constructor.prototype ),
				args = Z.slice.call( arguments );
			args.unshift( self );
			constructor.apply( state, args );
			return ( this.substates || ( this.substates = {} ) )[ name ] = state;
		},
		
		addSubstates: function ( input ) {
			var	self = this,
				key, value,
				substates = this.substates ||
					input && !Z.isEmpty( input ) && ( this.substates = {} );
			
			for ( key in input ) if ( Z.hasOwn( input, key ) ) {
				value = input[ key ];
				substates[ key ] =
					value instanceof State ?
						( value.superstate( this ), value.name( key ), value ) :
					Z.type( value ) === 'string' ?
						this.addSubstate( key, value ) :
					Z.isPlainObject( value ) ?
						this.addSubstate( key ).addSubstates( value ) :
					Z.isArray( value ) ?
						this.addSubstate( key, value[0] ).addSubstates( value[1] ) :
					this.addSubstate( key );
			}
			
			return self;
		}
	},
	
	lookup: function ( subject, state ) {
		state instanceof this || Z.type( state ) === 'string' && ( state = subject.substate( state ) );
		return state && subject.isSuperstateOf( state ) && state;
	}
};
