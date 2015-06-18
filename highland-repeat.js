(function(){
  var proto = highland().__proto__,
      nil = highland.nil;

  proto.repeat = function repeat () {
    var nothing = {},
        latest = nothing,
        errors = [],
        ended = false,
        onValue = null;

    this.consume(function (err, x, push, next) {
      if (onValue != null) {
        var cb = onValue;
        //onValue = null;
        cb(err, x);
      }

      if (err) {
        errors.push(err);
        next();
      }
      else if (x === nil) {
        ended = true;
      }
      else {
        latest = x;
        next();
      }
    }).resume();

    return _(function (push, next) {
      var oldErrors = errors;
      errors = [];

      if (!oldErrors.length && latest === nothing && !ended) {
        // We haven't gotten any data yet. We can't call next
        // because that might cause the stream to call the generator
        // again, resulting in an infinite loop. Thus, we stick a
        // a callback to be called whenever we get a value.
        onValue = function (err, x) {
          push(err, x);
          if (x !== nil) {
            next();
          }
        };
      }
      else {
        oldErrors.forEach(push);
        if (latest !== nothing) {
          push(null, latest);
        }
        if (ended) {
          push(null, nil);
        }
        else {
          next();
        }
      }
    });
  };
}());
