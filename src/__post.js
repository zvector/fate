extend( global, module.exports, {
	Deferral: Deferral,
	Promise: Promise,
	Queue: Queue,
	when: when
});

})( typeof module === 'undefined' ? { exports: {} } : module );
