// this is static/shared on the deferral prototype; it should not hold reference to any deferral instance

function State ( superstate, name ) {
	if ( !( this instanceof State ) ) {
		return Z.isPlainObject( superstate ) ?
			( new State( undefined, name ) ).addSubstates( superstate ) :
			new State( superstate, name );
	}
	
	var path;
	
	Z.extend( this, {
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
	this.name.toString = this.name;
	this.path.toString = this.path;
	
	return this;
}
Z.extend( true, State, {
	prototype: {
		toString: function () {
			return this.path();
		},
		
		substate: function ( path ) {
			return path ? Z.lookup( this.substates, path.replace( /\./g, '.substates.' ) ) : this;
		},
		
		substateList: function () {
			var	states = this.substates,
				key, result = [];
			for ( key in states ) {
				result.push( states[ key ] );
			}
			return result;
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
		
		isOrIsSuperstateOf: function ( state ) {
			return this === state || this.isSuperstateOf( state );
		},
		
		isRelated: function ( state ) {
			return this.root() === state.root();
		},
		
		counterpart: function ( foreignState ) {
			return foreignState.root().substate( this.path() );
		},
		
		isCounterpartOf: function ( foreignState ) {
			return this.path() === foreignState.path();
		},
		
		addSubstate: function ( type, name ) {
			var	args = Z.slice.call( arguments ),
				state;
			
			Z.isFunction( type ) && type.prototype instanceof State ||
				( name = type, args.unshift( type = this.constructor ) );
			
			state = Z.create( type.prototype );
			args[0] = this;
			type.apply( state, args );
			return ( this.substates || ( this.substates = {} ) )[ name ] = state;
		},
		
		addSubstates: function ( input ) {
			var	key, value,
				substates = this.substates ||
					input && !Z.isEmpty( input ) && ( this.substates = {} );
			
			for ( key in input ) if ( Z.hasOwn.call( input, key ) ) {
				value = input[ key ];
				substates[ key ] =
					value == null ?
						this.addSubstate( key ) :
					value instanceof State ?
						( value.superstate( this ), value.name( key ), value ) :
					Z.isString( value ) ?
						this.addSubstate( key, value ) :
					Z.isPlainObject( value ) ?
						this.addSubstate( key ).addSubstates( value ) :
					Z.isArray( value ) ?
						this.addSubstate( key, value[0] ).addSubstates( value[1] ) :
					this.addSubstate( key );
			}
			
			return this;
		}
	},
	
	lookup: function ( subject, state ) {
		state instanceof this || Z.isString( state ) && ( state = subject.substate( state ) );
		return state && subject.isSuperstateOf( state ) && state;
	}
});

Deferral.State = State;
