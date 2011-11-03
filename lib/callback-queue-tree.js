/**
 * Object used by a deferral instance to store callback queues that are associated with its
 * resolved substates.
 * 
 * Queues are stored in either of two tree structures. Each tree is a sparse reflection of
 * the owning deferral's state hierarchy, specified in `rootState`. The first tree is the
 * "capture" tree, and the second is the "bubble" tree. When a deferral is resolved, it
 * retrieves callbacks to be invoked by first walking the capture tree, from the root state
 * down to the targeted state, and then walking the bubble tree, from the targeted state
 * back up to the root state.
 */
function CallbackQueueTree ( rootState ) {
	var root, cache;
	
	Z.extend( this, {
		/**
		 * Returns the callback queue Array associated with the specified `state`; creates it if necessary.
		 */
		get: function ( state, flags ) {
			flags = flags ? Z.splitToHash( flags, ' ' ) : {};
			
			var	bubble = flags.bubble,
				capture = flags.capture || !bubble,
				readonly = flags.readonly,
				
				trunk = capture ? 'capture' : 'bubble',
				path = state.path(),
				cacheTrunk = cache[ trunk ],
				obj = cacheTrunk && cacheTrunk[ path ],
				derivation, name, next, i, l;
			
			if ( obj ) { return obj; }
			
			obj = root[ trunk ];
			derivation = state.derivation( rootState );
			i = 0, l = derivation.length;
			while ( i < l && obj ) {
				name = derivation[i].name();
				next = obj[ name ] || ( readonly ? undefined : ( obj[ name ] = [] ) );
				next && (
					++i < l ?
						Z.isArray( next ) &&
							( next = readonly ? undefined : ( obj[ name ] = { '': next } ) )
						:
						Z.isArray( next ) || ( next = next[''] )
				);
				obj = next;
			}
			return obj && ( cacheTrunk[ path ] = obj );
		},
		
		/**
		 * Discards callback queues; optionally limited to those associated with the specified state
		 * and its substates.
		 */
		empty: function ( state ) {
			var obj, path, pathDot, key, cacheTrunk, deletions, length;
			
			if ( !state || state === baseState ) {
				root = { capture: { '':[] }, bubble: { '':[] } };
				cache = { capture: {}, bubble: {} };
			}
			else if ( baseState.isSuperstateOf( state ) ) {
				path = state.superstate().path();
				Z.forEach( [ 'capture', 'bubble' ], function ( trunk ) {
					obj = Z.lookup( root[ trunk ], path );
					if ( obj ) {
						// Prune the branch associated with this state
						obj[ state.name() ] = null;
					
						// Remove any related cached entries
						cacheTrunk = cache[ trunk ], pathDot = path + '.';
						for ( key in cacheTrunk ) if ( Z.hasOwn.call( cacheTrunk, key ) ) {
							( key === path || key.indexOf( pathDot ) === 0 ) &&
								deletions.push( key );
						}
						for ( length = deletions.length; --length; ) {
							delete cacheTrunk[ deletions.pop() ];
						}
					}
				});
			}
			return this;
		}
	});
	
	this.empty();
}
