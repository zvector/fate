function Multiplex ( width, operations ) {
	if ( !( this instanceof Multiplex ) ) {
		return new Multiplex( width, operations );
	}
	if ( arguments.length === 1 ) {
		operations = argument[0], width = operations.length;
	}
	
	var	self = this,
		deferral = ( new Deferral ).as( this ),
		args,
		running = false,
		pipeCount = 0,
		first, last;
	
	function append () {
		var pipe = Pipeline( operations )
			.on( 'didOperation', didOperation )
			.on( 'willContinue', willContinue )
		;
		last = last ? ( ( pipe.previous = last ).next = pipe ) : ( first = pipe );
		pipe.promise()
			.always( function () {
				remove( pipe );
			});
		running && pipe.start.apply( pipe, args );
		pipeCount++;
		return pipe;
	}
	
	function remove ( pipe ) {
		var previous = pipe.previous, next = pipe.next;
		previous && ( previous.next = next ), next && ( next.previous = previous );
		previous || next || self.stop();
		return pipe;
	}
	
	function didOperation ( event ) {
		var pipe = event.target;
		args = event.args;
	}
	
	function willContinue ( event ) {
		var pipe = event.target;
		if ( pipeCount > width ) {
			pipeCount--;
			pipe.stop();
		}
	}
	
	function start () {
		args = slice.call( arguments );
		running = true;
		this.start = getThis, this.stop = stop;
		while ( pipeCount < width ) {
			append();
		}
		return this;
	}
	
	function stop () {
		running = false;
		this.start = start, this.stop = getThis;
		deferral.given( args ).affirm();
		return this;
	}
	
	forEach( Multiplex.arrayMethods, function ( method ) {
		self[ method ] = function () {
			return Array.prototype[ method ].apply( operations, arguments );
		};
	});
	
	extend( this, {
		promise: function () { return deferral.promise(); },
		width: function ( value ) {
			if ( value !== undefined ) {
				width = value;
				while ( pipeCount < width ) {
					append();
				}
			}
			return width;
		},
		start: start,
		stop: getThis
	});
}
extend( Multiplex, {
	arrayMethods: 'push pop shift unshift reverse splice'.split(' ')
});