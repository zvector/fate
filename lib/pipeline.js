/**
 * A **pipeline** executes a sequence of synchronous or asynchronous functions in order, passing a set of
 * arguments from one to the next as each operation completes.
 */
 Z.inherit( Pipeline, Future );

function Pipeline ( operations ) {
	if ( !( this instanceof Pipeline ) ) {
		return new Pipeline( operations );
	}
	
	var	self = this,
		context = self,
		args,
		deferral,
		continuation,
		running = false,
		pausePending = false,
		events = Z.assign( 'didContinue willContinue', null );
	
	function returnSelf () {
		return self;
	}
	
	function emit ( eventType, obj ) {
		var callbacks = events[ eventType ], i, l;
		
		obj = Z.extend({
			pipeline: self,
			continuation: continuation,
			context: context,
			args: args
		}, obj );

		if ( callbacks ) {
			for ( i = 0, l = callbacks.length; i < l; i++ ) {
				callbacks[i].call( self, obj );
			}
		}
	}
	
	function reset () {
		return deferral = ( new Deferral ).as( context );
	}
	
	function next () {
		return continuation = operations.shift();
	}
	
	function continueAsynchronously () {
		args = Z.slice.call( arguments );
		emit( 'didContinue' );
		pausePending && ( running = pausePending = false );
		if ( running ) {
			if ( next() != null ) {
				emit( 'willContinue' );
				callcc.apply( continuation, args );
			} else {
				self.stop();
			}
		}
	}

	function callcc () {
		var result;
		
		while ( continuation != null || next() != null ) {
			result = Z.isFunction( continuation ) ?
				continuation.apply( context, args ) : continuation;
			
			// Asynchronous: defer continuation and return immediately
			if ( Future.resembles( result ) ) {
				result.then( continueAsynchronously, self.abort );
				return;
			}
			
			// Synchronous: continue within loop until met with an asynchronous operation, the
			// end of the pipeline, or `null`|`undefined`
			else {
				args = result === undefined ? [] : Z.isArray( result ) ? result : [ result ];
				emit( 'didContinue' );
				pausePending && ( running = pausePending = false );
				if ( running ) {
					if ( next() != null ) {
						emit( 'willContinue' );
						continue;
					} else {
						break;
					}
				}
			}
		}
		
		self.stop();
	}
	
	function as ( context_ ) {
		deferral.as( context = context_ );
		return self;
	}
	
	function given ( args_ ) {
		deferral.given( args = args_ );
		return self;
	}
	
	function start () {
		arguments.length && ( args = Z.slice.call( arguments ) );

		( !deferral || deferral.did() ) && reset();
		running = true;
		
		self.as = self.given = self.start = returnSelf;
		self.pause = pause, self.resume = resume, self.stop = stop, self.abort = abort;
		
		callcc.apply( next(), args );
		return self;
	}
	
	function pause () {
		pausePending = true;
		self.resume = resume, self.pause = returnSelf;
		return self;
	}
	
	function resume () {
		running = true, pausePending = false;
		self.pause = pause, self.resume = returnSelf;
		callcc.apply( next(), args );
		return self;
	}
	
	function stop () {
		running = pausePending = false;
		
		self.as = as, self.given = given, self.start = start;
		self.pause = self.resume = self.stop = self.abort = returnSelf;
		
		deferral.given( args ).affirm();
		return self;
	}
	
	function abort () {
		running = pausePending = false;
		
		self.as = as, self.given = given, self.start = start;
		self.pause = self.resume = self.stop = self.abort = returnSelf;
		
		deferral.given( args ).negate();
		return self;
	}
	
	Z.isArray( operations ) || ( operations = [] );

	Z.forEach( Pipeline.arrayMethods, function ( method ) {
		self[ method ] = function () {
			return Array.prototype[ method ].apply( operations, arguments );
		};
	});
	
	Z.extend( this, {
		length: Z.valueFunction( function () { return operations.length; } ),
		promise: function () { return deferral.promise(); },
		continuation: function () { return continuation; },
		args: function () { return Z.slice.call( args ); },
		isRunning: Z.valueFunction( function () { return running; } ),
		as: as,
		given: given,
		start: start,
		pause: returnSelf,
		resume: returnSelf,
		stop: returnSelf,
		abort: returnSelf,
		on: function ( eventType, fn ) {
			var callbacks = events[ eventType ] || ( events[ eventType ] = [] );
			return callbacks && callbacks.push( fn ) && this;
		}
	});
	
	reset();
}
Z.extend( Pipeline, {
	arrayMethods: 'push pop shift unshift reverse splice'.split(' ')
});
