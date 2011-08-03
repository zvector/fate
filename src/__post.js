extend( global, module.exports, {
	Deferral: Deferral,
	Promise: Promise,
	// Operation: Operation,
	when: when
});

})( typeof module === 'undefined' ? { exports: {} } : module );
