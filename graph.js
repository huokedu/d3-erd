// menu click handler
d3.select("[href=\"#addNode\"]")
  .on("click", function () { return d3.event.preventDefault(), addNode = true });

// helpers
function compose(/* Function... */) {
    var fns = arguments;

    return function (result) {
      for (var i = fns.length - 1; i > -1; i--)
        result = fns[i].call(this, result);

      return result;
    }
}

function translate(x, y) {
  return function (d) {
    return "translate(" + x(d) + ", " + y(d) + ")";
  }
}

function fn(name /* args... */) {
  var args = Array.prototype.slice.call(arguments, 1);
  return function (obj) {
    return obj ? obj[name] ? obj[name].apply(obj, args) : undefined : undefined;
  }
}

function self() {
  return this;
}

function id(x) {
  return x;
}

function prop(name) {
  if (name.indexOf(".") > -1)
    return compose.apply(null, name.split(".").map(function(_, i, names){
      return prop(names[names.length - i - 1]);
    }));

  return function (obj) {
    return obj ? obj[name] : undefined
  }
}

function div(b) {return function(a) {return isFinite(a) ? a / b : undefined}}
function mul(b) {return function(a) {return isFinite(a) ? a * b : undefined}}
function add(b) {return function(a) {return isFinite(a) ? a + b : undefined}}
function sub(b) {return function(a) {return isFinite(a) ? a - b : undefined}}

var half = div(2);
var double = mul(2);

// create a node
function makeNode(name, x, y){
  return {
    x: x || 0,
    y: y || 0,
    name: name || "unnamed",
    height: "2em",
    width: "6em"
  }
}

// create a link
function makeLink(a, b) {
  return {
    left: a,
    right: b
  }
}

// initial graph
var graph = {nodes: [], links: [], history: []};

// constants
var height = 600,
    width = 600;

// canvas
var svg = d3.select("svg")
    .attr("height", height)
    .attr("width", width)
    .on("mousedown", mousedown)
    .on("mousemove", mousemove);

// hold the state which menu item has been
// clicked last
var addNode = false,
    newLink = null;

// select nodes and links
var node = svg.selectAll(".node"),
    link = svg.selectAll(".link");

// mouseover handler
function mousemove() {
  if (!newLink)
    return;

  var point = d3.mouse(this);
  svg.selectAll(".new-link")
    .attr("x2", point[0])
    .attr("y2", point[1]);
}

// mousdown handler
function mousedown() {
  var point = d3.mouse(this);

  if (addNode) {
    graph.nodes.push(makeNode(prompt("give the node a name"),
                              point[0],
                              point[1]));

    addNode = false;
    draw();
  }
}

// create a link
function addLink(d) {
  if (!newLink) {
    newLink = {left: d};
    svg.append("line")
      .attr("x1", newLink.left.x)
      .attr("y1", newLink.left.y)
      .attr("x2", newLink.left.x)
      .attr("y2", newLink.left.y)
      .attr("class", "new-link");

  } else {
    newLink.right = d;
    graph.links.push(newLink);
    svg.selectAll(".new-link").remove();
    newLink = null;
    draw();
  }
}

// draw the graph
function draw() {

  // update nodes
  node = node.data(graph.nodes, prop("name"));

  // insert new nodes
  var tmp = node.enter()
      .insert("g")
      .attr("class", "node")
      .attr("transform", translate(prop("x"), prop("y")))
      .each(function(d) {

        // draw a box
        var n = d3.select(this);
        var x = d.x, y = d.y;

        n.append("rect")
          .attr("height", prop("height"))
          .attr("width", prop("width"));

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
          .text(prop("name"))
          .attr("x", bbox.width/2)
          .attr("y", compose(prop("height"), fn("getBBox"), self));

        // draw the "add link" handlers
        n.selectAll("circle")
          .data(d.anchors)
          .enter()
          .append("circle")
          .attr("class", "add-link")
          .attr("r", 5)
          .attr("cx", compose(sub(x), prop("x")))
          .attr("cy", compose(sub(y), prop("y")))
          .on("mousedown", addLink)
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
    .insert("g", ".node") // insert before first .node
    .attr("class", "link")
    .each(function(d){
      var conn = connector()
					.left(prop("left"))
					.right(prop("right"))
					.offset(20)(d);

      d3.select(this)
        .append("path")
        .attr("d", conn.lines);

      d3.select(this)
        .selectAll("circle")
        .data(conn.handles)
        .enter()
        .append("circle")
        .attr("class", "handle")
        .attr("cx", prop("x"))
        .attr("cy", prop("y"))
        .attr("r", 5);
    });

  // remove old links
  link.exit()
    .remove();
}

function connector() {
  return (function(){
    var x = prop("x"),
        y = prop("y"),
				anchor = prop("anchor"),
				left = prop("left"),
				right = prop("right"),
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

		var k = function (data) {

			var lines = [],
					handles = [],
					l = left(data),
					r = right(data),
					la = anchor(l),
					ra = anchor(r),
					i = 1;

			var p = off(l),
					q = off(r),
					s, t;

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
				lines = [l, p, q, r];
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
						lines = [l, p, q, r];
					}	else {
						// (p)-(s) [r]
						//  |   |   |
						// [l] (t)-(q)
						s = {x: p.x + (q.x - p.x)/2, y: p.y};
						t = {x: s.x, y: q.y};
						lines = [l, p, s, t, q, r];
					}
				} else if (la === "west" || la === "east") {
					if ((la === "east" && p.x < q.x)
							||(la === "west" && p.x > q.x)) {
						// [l]-(p)
						//      |
						//     (q)-[r]
						p.x = q.x = p.x + (q.x - p.x)/2;
						lines = [l, p, q, r];
					}	else {
						// [l]-(p)
						//      |
						// (t)-(s)
						//  |
						// (q)-[r]
						s = {y: p.y + (q.y - p.y)/2, x: p.x};
						t = {y: s.y, x: q.x};
						lines = [l, p, s, t, q, r];
					}
				}
			}

			lines = lines.reduce(function(o, p, i){
				o.path += (i === 0 ?
												x(p) + "," + y(p) :
												((i + o.d) % 2 === 0 ?
												 ("v" + -(y(o.l) - y(p))) :
												 ("h" + -(x(o.l) - x(p)))));
				o.l = p;
				return o;
			}, {
				path:"m",
				d: (la === "north" || la === "south") ? 1 : 0
			}).path;


      return {
				lines: lines,
				handles: handles
			};
		}

    k.x = function(f) {x = f; return k};
		k.y = function(f) {y = f; return k};
		k.left = function(f) {left = f; return k};
		k.right = function(f) {right = f; return k};
  	k.anchor = function(f) {anchor = f; return k};
		k.offset = function(o) {offset = o; return k};

    return k;
  }());
}
