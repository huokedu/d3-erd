// constants
var KEYCODES = {
  ESC: 27,
	SPACE: 32,
	TAB: 9,
  L: "L".charCodeAt(0),
  N: "N".charCodeAt(0),
  E: "E".charCodeAt(0),
	Z: "Z".charCodeAt(0),
	Y: "Y".charCodeAt(0)
};

var MENU = {
  addLink: $('[href="#addLink"]'),
  addNode: $('[href="#addNode"]'),
	pan: $('[href="#pan"]'),
  redo: $('[href="#redo"]'),
  undo: $('[href="#undo"]'),
};

// frp
var _ = highland;
var nil = highland.nil;
var compose = highland.compose;
var not = highland.not;
var get = highland.get;
var log = console.log.bind(console);

// DOM selectors
function $(s, c){ return (c || document).querySelector(s); }
function $$(s, c){ return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

// helper
function self() {return this;}
function id(x)  {return x;}
function div(b) {return function(a) {return isFinite(a) ? a / b : undefined}}
function mul(b) {return function(a) {return isFinite(a) ? a * b : undefined}}
function add(b) {return function(a) {return isFinite(a) ? a + b : undefined}}
function sub(b) {return function(a) {return isFinite(a) ? a - b : undefined}}
function is(b)  {return function(a) {return b === a}}
function preventDefault(e){ e.preventDefault(); }
function getLinkNode(t){ while (t && (t.nodeName !== "A")) t = t.parentNode; return t;}

function throttle(t, fn) {
  var _t = null;
  return function(/* args... */) {
    var self = this, args = Array.prototype.slice.call(arguments);
    if (_t) clearTimeout(_t);
    setTimeout(function(){fn.apply(self, args);}, t);
  }
}

function find(arr, filter) {
  for (var i = 0; i < arr.length; i++) {
    if (filter.call(arr[i], arr[i], i, arr))
      return i;
  }
  return -1;
}

function generateUUID() {
  var d = new Date().getTime();
  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (d + Math.random()*16)%16 | 0;
    d = Math.floor(d/16);
    return (c=='x' ? r : (r&0x3|0x8)).toString(16);
  });
  return uuid;
};

function cssTranslate(x, y) {
  return function (d) {
    return "translate(" + x(d) + ", " + y(d) + ")";
  }
}


function method(name /* args... */) {
  var args = Array.prototype.slice.call(arguments, 1);
  return function (obj) {
    return obj ? obj[name] ? obj[name].apply(obj, args) : undefined : undefined;
  }
}

/**
 * Creates an event stream from DOM events
 *
 * @param {String} ev the event type, e.g. 'click'
 * @param {DOMNode} the DOM Node to listen on
 * @return highland stream
 */
function fromEvents(ev, node) {
	var s = _();
	node.addEventListener(ev, s.write.bind(s));
	return s;
}

// global event streams
var mouseClicks = fromEvents("click", document).tap(preventDefault),
		mouseMoves = fromEvents("mousemove", document).debounce(10).latest(),
		mouseDowns = fromEvents("mousedown", document).debounce(100).latest(),
		mouseUps = fromEvents("mouseup", document).debounce(100).latest(),
    keyDowns = fromEvents("keydown", document).pluck("which"),
    keyUps = fromEvents("keyup", document).pluck("which");

function dragStream(){
	var mv = mouseMoves.fork();
	var up = mouseUps.fork();
	var _pos, ended;

	up.each(function(){_pos = null; mv.destroy()});

	return mv.consume(function(err, pos, push, next){
		if (err) return push(err), next();
		if (pos === nil) return push(null, nil);
		if (!_pos) {
			_pos = {
				x1: pos.offsetX, y1: pos.offsetY,
				x2: pos.offsetX, y2: pos.offsetY,
				dx: 0, dy: 0
			}
		} else {
			_pos.x2 = pos.offsetX; _pos.y2 = pos.offsetY;
			_pos.dx = _pos.x2 - _pos.x1; _pos.dy = _pos.y2 - _pos.y1;
		}
		return push(null, _pos), next();
	});
}

var svgDrag = mouseDowns.fork()
		.filter(function(e){return e.target.nodeName.match(/svg/i)})
		.map(dragStream);

var addingNode = _(),
    addingLink = _(),
		panning = _(),
		undoing = _(),
		redoing = _(),
    undoable = _(),
    redoable = _(),
    menuStates = [addingNode, addingLink, panning];

addingLink.each(function(s){
  addingLink._last = s;
  if (s) menuStates.     filter(compose(not, is(addingLink))).forEach(function(s){s.write(false)});
  if (!s) svg.selectAll(".new-link").remove();
  MENU.addLink.classList[s?"add":"remove"]("active");
  document.body.classList[s ? "add":"remove"]("adding-link");
});

addingNode.each(function(s){
  addingNode._last = s;
  if (s) menuStates.filter(compose(not, is(addingNode))).forEach(function(s){s.write(false)});
  MENU.addNode.classList[s?"add":"remove"]("active");
  document.body.classList[s ? "add":"remove"]("adding-node");
});

undoable.each(function(s){
  MENU.undo.setAttribute("disabled", !s);
});

redoable.each(function(s){
  MENU.redo.setAttribute("disabled", !s);
});

panning.each(function(s){
	panning._last = s;
  if (s) menuStates.filter(compose(not, is(panning))).forEach(function(s){s.write(false)});
  MENU.pan.classList[s?"add":"remove"]("active");
	document.body.classList[s ? "add":"remove"]("panning");
});

undoing.each(function(){
  if (graph.undo()) draw(graph);
  undoable.write(graph.undoable());
});

redoing.each(function(){
  if (graph.redo()) draw(graph);
  redoable.write(graph.redoable());
});

// mouseclicks on menu
mouseClicks
  .fork()
	.pluck("target")
  .map(getLinkNode)
  .each(function(n) {
    if (n === MENU.addLink) addingLink.write(!addingLink._last);
    if (n === MENU.addNode) addingNode.write(!addingNode._last);
		if (n === MENU.pan) panning.write(!panning._last);
    if (n === MENU.undo) undoing.write(true);
    if (n === MENU.redo) redoing.write(true);
  });

// keyboard keydown
keyDowns
	.each(function(k){
		switch (k) {
		case KEYCODES.SPACE: panning.write(true); break;
		}
	});

// keyboard keyup
keyUps
  .each(function(k){
    switch (k) {
    case KEYCODES.L: addingLink.write(!addingLink._last); break;
    case KEYCODES.N: addingNode.write(!addingNode._last); break;
    case KEYCODES.ESC: menuStates.forEach(method("write", false)); break;
		case KEYCODES.SPACE: panning.write(false); break;
		case KEYCODES.Z: undoing.write(true); break;
		case KEYCODES.Y: redoing.write(true); break;
    }
  });


var graph = (function(){

  // initial graph
  var links = [],
      nodes = [],
      history = {};

  var _index = 0,
      _length = 0;

  function byId(x){ return function(n){return n.id === x.id} }

  var actions = {
    make: function(a, b){ a.push(b); },
    remove: function(a, b){ a.splice(find(a, byId(b)), 1); }
  };

  // save at most every 1000ms
  var save = throttle(1000, function save(name, target) {
    if (!target) {
      localStorage[name] = CircularJSON.stringify({
				links: links,
				nodes: nodes,
				history: history,
				index: _index,
				length: _length
			});
    } else if (target === "local") {
			var s = CircularJSON.stringify({
				links: links,
				nodes: nodes,
				history: history,
				index: _index,
				length: _length
			}, null, "  ");
      var a = document.createElement("a");
      a.download = name;
      a.href = "data:application/json;base64," + btoa(s);
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
    }

    return g;
  });

  function load(source, cb) {
    if (!source || source === localStorage) {
      _cb(CircularJSON.parse(localStorage.store));
    } else if (source === "local") {
      var f = document.createElement("input");
      f.type = "file";
      f.style.display = "none";
      f.accept = "application/json";
      f.onchange = function() {
        var reader = new FileReader();
        reader.onload = function(e) {
          _cb(CircularJSON.parse(e.target.result));
          f.parentNode.removeChild(f);
        };
        reader.readAsText(f.files[0]);
      }
      document.body.appendChild(f);
      f.click();
    }

    function _cb(x) {
      links = g.links = x.links;
      nodes = g.nodes = x.nodes;
      history = g.history = x.history;
      _index = x.index;
      _length = x.length;
      cb && cb(g);
    }
  }

  function push (next) {
    next.time = +new Date();
    // link
    history._redo = next;
    next._undo = history;

    // advance pointer
    history = next;
    _length = ++_index;

    // perform
    actions[history.action === "make" ? "make" : "remove"](history.where === "node" ? nodes : links, history.what);

    // save
    save("store");

    // all went well
    return true;
  }
  function undo () {
    // nothing to undo
    if (_index === 0)
      return false;

    // perform
    actions[history.action === "make" ? "remove" : "make"](history.where === "node" ? nodes : links, history.what);

    // roll back pointer
    history = history._undo
    _index--;

    // all went well
    return true;
  }
  function redo () {
    // nothing to redo
    if (_index === _length)
      return false;

    // roll forward pointer
    history = history._redo;
    _index++;

    // perform
    actions[history.action === "make" ? "make" : "remove"](history.where === "node" ? nodes : links, history.what);

    // all went well
    return true;
  }

  // create a node
  function makeNode(x, y){
    var n = {
      id: generateUUID(),
      x: x || 0,
      y: y || 0,
      name: "unnamed",
      height: "2em",
      width: "6em"
    };
    push({action: "make", where: "node", what: n});
    return g;
  }

  // create a link
  function makeLink(a, b) {
    var l = {
      left: a,
      right: b,
      waypoints: waypoints()(a, b),
      id: generateUUID()
    };
    push({action: "make", where: "link", what: l});
    svg.addingLink(false);
    return g;
  }

  var g = {
    makeLink: makeLink,
    makeNode: makeNode,
    nodes: nodes,
    links: links,
    history: history,
    undo: undo,
    redo: redo,
    load: load,
    save: save,
    redoable: function () { return _index < _length },
    undoable: function () { return _index > 0 },
  };

  return g;
}());

// mousdown handler
var mousedown = (function(){
  var left = null;

  return function () {
    var point = d3.mouse(this);

    if (svg.addingNode()) {
      d3.event.preventDefault();
      svg.addingNode(false);
      draw(graph.makeNode(point[0], point[1]));
      return
    }

    if (svg.addingLink() && d3.event.target.classList.contains("add-link")) (function(){
      d3.event.preventDefault();
      var right = d3.select(d3.event.target).data()[0];
      if (!left) {
        left = right;
        svg.append("line")
          .attr("x1", left.x)
          .attr("y1", left.y)
          .attr("x2", left.x)
          .attr("y2", left.y)
          .attr("class", "new-link");
      } else {
        svg.selectAll(".new-link").remove();
        draw(graph.makeLink(left, right));
        left = null;
      }
    }());
  }
}());

// canvas
var svg = d3.select("svg")
    .attr("height", "100%")
    .attr("width", "100%")
		.append("g");

svg.append("text").text("yo");

var svgPan = _().each(function(drg) {
	var cur = [0,0];
	if (svg.attr("transform"))
		cur = svg.attr("transform").substr(10).replace(")", "").split(/, +/).map(Number);

	console.log(cur);
	drg.each(function(pos){console.log("d", drg.id, cur, [pos.dx, pos.dy], [cur[0]+pos.dx,cur[1]+pos.dy]);
		svg.attr("transform", "translate(" + (cur[0]+pos.dx) + ", " + (cur[1]+pos.dy) + ")");
	});
});

svgDrag.pipe(svgPan);

// mouseover handler
function mousemove() {
  if (!svg.addingLink())
    return svg.selectAll(".new-link").remove();

  var point = d3.mouse(this);
  svg.selectAll(".new-link")
    .attr("x2", point[0])
    .attr("y2", point[1]);
}

function draw(graph) {

  var node = svg.selectAll(".node"),
      link = svg.selectAll(".link");

  svg.undoable(graph.undoable());
  svg.redoable(graph.redoable());

  // update nodes
  node = node.data(graph.nodes, get("id"));

  // insert new nodes
  var tmp = node.enter()
      .insert("g")
      .attr("class", "node")
      .attr("transform", cssTranslate(get("x"), get("y")))
      .each(function(d) {

        // draw a box
        var n = d3.select(this);
        var x = d.x, y = d.y;

        n.append("rect")
          .attr("height", get("height"))
          .attr("width", get("width"));

        var bbox = this.getBBox();

        d.anchors = [
          {x: x + bbox.width/2, y: y + 0, node: d, anchor: "north"},
          {x: x + bbox.width, y: y + bbox.height/2, node: d, anchor: "east"},
          {x: x + bbox.width/2, y: y + bbox.height, node: d, anchor: "south"},
          {x: x + 0, y: y + bbox.height/2, node: d, anchor: "west"}
        ];

        // write the title
        n.append("text")
          .attr("class", "title")
          .text(get("name"))
          .attr("x", bbox.width/2)
          .attr("y", compose(get("height"), method("getBBox"), self));

        // draw the "add link" handlers
        n.selectAll("circle")
          .data(d.anchors)
          .enter()
          .append("circle")
          .attr("class", "add-link")
          .attr("r", 5)
          .attr("cx", compose(sub(x), get("x")))
          .attr("cy", compose(sub(y), get("y")))
          .append("title")
          .text("add link");
      });

  // remove old nodes
  node.exit()
    .remove();

  // update links
  link = link.data(graph.links);

  // insert new links
  link.enter()
    .insert("path") // insert before first .node
    .attr("class", "link")
    .attr("d", compose(d3.svg.line().x(get("x")).y(get("y")), get("waypoints")));

  // remove old links
  link.exit()
    .remove();
}


var waypoints = function(){
  return function(){

    var x = get("x"),
        y = get("y"),
			  anchor = get("anchor"),
			  offset = 20;

	  function off(d) {
		  var a = anchor(d);
		  if (a === "north")
			  return { x: x(d), y: y(d) - offset };
		  if (a === "east")
			  return { x: x(d) + offset, y: y(d) };
		  if (a === "south")
			  return { x: x(d), y: y(d) + offset };
		  if (a === "west")
			  return { x: x(d) - offset, y: y(d) };
	  }

	  function dir(x) {
		  return x === "north" ? 0 : x === "east" ? 1 : x === "south" ? 2 : 3;
	  }

	  var w = function (l, r) {

		  var la = anchor(l),
				  ra = anchor(r);

		  var p = off(l),
				  q = off(r),
				  s, t;

      l = {x: l.x, y: l.y};
      r = {x: r.x, y: r.y};

		  if (la === ra) {
			  // anchors point in same direction
			  //    [l]----(p)
			  //            |
			  //       [r]-(q)
			  switch (la) {
			  case "north":
				  p.y = q.y = Math.min(p.y, q.y); break;
			  case "south":
				  p.y = q.y = Math.max(p.y, q.y); break;
			  case "west":
				  p.x = q.x = Math.min(p.x, q.x); break;
			  case "east":
				  p.x = q.x = Math.max(p.x, q.x); break;
			  }
			  return [l, p, q, r];
		  }	else if ( (dir(la) + dir(ra)) % 2 === 0) {
			  // anchors point in opposite direction
			  // [n, e, s, w] = [0, 1, 2, 3]
			  // (n+s) % 2 === (e+w) % 2 === 0 // true
			  if (la === "north" || la === "south") {
				  if ((la === "north" && p.y > q.y)
						  ||(la === "south" && p.y < q.y)) {
					  //      [r]
					  //       |
					  // (p)--(q)
					  //  |
					  // [l]
					  p.y = q.y = p.y + (q.y - p.y)/2;
					  return [l, p, q, r];
				  }	else {
					  // (p)-(s) [r]
					  //  |   |   |
					  // [l] (t)-(q)
					  s = {x: p.x + (q.x - p.x)/2, y: p.y};
					  t = {x: s.x, y: q.y};
					  return [l, p, s, t, q, r];
				  }
			  } else if (la === "west" || la === "east") {
				  if ((la === "east" && p.x < q.x)
						  ||(la === "west" && p.x > q.x)) {
					  // [l]-(p)
					  //      |
					  //     (q)-[r]
					  p.x = q.x = p.x + (q.x - p.x)/2;
					  return [l, p, q, r];
				  }	else {
					  // [l]-(p)
					  //      |
					  // (t)-(s)
					  //  |
					  // (q)-[r]
					  s = {y: p.y + (q.y - p.y)/2, x: p.x};
					  t = {y: s.y, x: q.x};
					  return [l, p, s, t, q, r];
				  }
			  }
		  }
	  }

    w.x = function(f) {x = f; return w};
	  w.y = function(f) {y = f; return w};
	  w.offset = function(o) {offset = o; return w};

    return w;

  };
}


// info about saved work
(function(){
	if (!localStorage.store)
		return;

	var a = document.createElement("div");
	a.classList.add("alert");
	a.classList.add("alert-info");
	a.classList.add("alert-dismissable");
	a.setAttribute("role", "alert");
	a.innerHTML = '<button type="button" class="close" data-dismiss="alert" aria-label="Close">'
		+ '<span aria-hidden="true">&times;</span></button>'
		+ '<strong>Hi!</strong> It seems you\'ve been working on something before. Would you like to '
		+ '<a href="#reload" class="alert-link">reload</a> it?';
	$("#alerts").appendChild(a);

	$('[href="#reload"]').addEventListener("click", function(e){
		e.preventDefault();
		graph.load(localStorage, draw);

	});

	setTimeout(function(){
		a.classList.add("fade");
		setTimeout(function(){
			if (a.parentNode) a.parentNode.removeChild(a)
		}, 600);
	}, 10000);

}());
