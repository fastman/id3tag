var fs = require('fs');
var Iconv  = require('iconv').Iconv;

var FRAME_ID_LEN = 4;

var Encoding = {};
Encoding.ISO88591 = 0x00;
Encoding.UTF16    = 0x01;
Encoding.UTF16BE  = 0x02;
Encoding.UTF8     = 0x03;
Encoding.Convert = ['ISO-8859-1', 'UTF16', 'UTF-16BE', 'UTF8'];

var getSize = function (buffer, offset) {
    var b = buffer.slice(offset, offset + 4);
    return  (b[0] << 21) + (b[1] << 14) + (b[2] << 7) + b[3];
};

var Id3Tag = function (frame) {
    this._frame = frame;
};

Id3Tag.prototype.getTag = function () {
    return this._frame.getId();
};

Id3Tag.prototype.getValue = function () {
    if (this.getTag().match(/^T/)) {
        var buffer = this._frame.getValue();
        var value;
        if (buffer[0] == Encoding.UTF8) {
            var end = buffer[buffer.length - 1] == 0 ? buffer.length - 1 : buffer.length;
            value = buffer.slice(1, end).toString();
        } else {
            var iconv = new Iconv(Encoding.Convert[buffer[0]], 'UTF-8');
            console.log(this.getTag(), Encoding.Convert[buffer[0]], buffer);
            var end = buffer[buffer.length - 1] == 0 && buffer[buffer.length - 2] == 0 ? buffer.length - 2 : buffer.length;
            value = iconv.convert(buffer.slice(1, end)).toString();
        }


        return value;
    } else {
        return this._frame.getValue();
    }
};

var Id3Frame = function (buffer, offset, version) {
    this._buffer      = buffer;
    this._offset      = offset;
    this._orig_offset = offset;
    this._version     = version;

    this.id     = this.getId();
    this.length = this.getLength();
    this.flags  = this.getFlags();
};

Id3Frame.prototype.getId = function () {
    if (!this.id) {
        return this._buffer.slice(this._offset, this._offset += FRAME_ID_LEN).toString(); 
    }
    return this.id;
};

Id3Frame.prototype.getLength = function () {
    if (!this.length) {
        var sizeBuf = this._buffer.slice(this._offset, this._offset += FRAME_ID_LEN);
        if (this._version == 4) {
            return getSize(sizeBuf, 0);
        } else {
            return sizeBuf.readInt32BE(0);
        }
    }
    return this.length;
};

Id3Frame.prototype.getFlags = function () {
    if (!this.flags) {
        return this._buffer.slice(this._offset, this._offset += 2);
    }
    return this.flags;
};

Id3Frame.prototype.getValue = function () {
    return this._buffer.slice(this._offset, this._offset + this.getLength());
};

Id3Frame.prototype.getOffset = function () {
    return this._offset + this.length;
};

var Mp3 = function (data) {
    this._offset = 0;
    this._buffer = data;
};

Mp3.prototype._read = function (length) {
    return this._buffer.slice(this._offset, this._offset += length);
};

Mp3.prototype._seek = function (length) {
    this._offset = this._offset + length;
    return this._offset;
};


var offset = 0;
var mp3 = 'mp3/4190439_Blackout_Original_Mix.mp3';

var buf = fs.readFileSync(process.argv[2]);

var isTag = buf.slice(0, 3);
offset += 3;

var major_version = buf.readUInt8(offset);
offset += 1;

var revision_number = buf.readUInt8(offset);
offset += 1;

console.log(isTag.toString());
console.log('major_version:', major_version);
console.log('revision_number:', revision_number);

var flags = {};

console.log(offset);

flag_binary = buf.readUInt8(offset) ;
offset += 1;

flags.unsync = flag_binary & 0x80;
flags.ext    = flag_binary & 0x40;
flags.exp    = flag_binary & 0x20;
flags.foot   = flag_binary & 0x10;

console.log('flags:', flags);

if (major_version == 4) {
    var len = getSize(buf, offset);
} else {
    var len = buf.readInt32BE(offset);
}
offset += 4;
console.log('len:', len);


var tags = {};
var frame;
var tag;

while (buf.slice(offset, offset + FRAME_ID_LEN)[0] != 0) {
    frame = new Id3Frame(buf, offset, major_version);
    offset = frame.getOffset();
    tag = new Id3Tag(frame);

    if (tags.hasOwnProperty(tag.getTag())) {
        if (!Array.isArray(tags[tag.getTag()])) {
            tags[tag.getTag()] = [tags[tag.getTag()]];
        }
        tags[tag.getTag()].push(tag.getValue());
    } else {
        tags[tag.getTag()] = tag.getValue();
    }
}

while (offset < buf.length) {
    if (buf[offset] == 0xFF) {
        console.log('MP3 poczatek');
        break;
    }
    offset++;
}

console.log(tags);

