/*
* Licensed to the Apache Software Foundation (ASF) under one
* or more contributor license agreements.  See the NOTICE file
* distributed with this work for additional information
* regarding copyright ownership.  The ASF licenses this file
* to you under the Apache License, Version 2.0 (the
* "License"); you may not use this file except in compliance
* with the License.  You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing,
* software distributed under the License is distributed on an
* "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
* KIND, either express or implied.  See the License for the
* specific language governing permissions and limitations
* under the License.
*/
// FIXME emphasis label position is not same with normal label position
import * as textContain from 'zrender/src/contain/text';
var RADIAN = Math.PI / 180;

function adjustSingleSide(list, cx, cy, r, dir, viewWidth, viewHeight) {
  list.sort(function (a, b) {
    return a.y - b.y;
  });

  function shiftDown(start, end, delta, dir) {
    for (var j = start; j < end; j++) {
      list[j].y += delta;

      if (j > start && j + 1 < end && list[j + 1].y > list[j].y + list[j].height) {
        shiftUp(j, delta / 2);
        return;
      }
    }

    shiftUp(end - 1, delta / 2);
  }

  function shiftUp(end, delta) {
    for (var j = end; j >= 0; j--) {
      list[j].y -= delta;

      if (j > 0 && list[j].y > list[j - 1].y + list[j - 1].height) {
        break;
      }
    }
  }

  function changeX(list, isDownList, cx, cy, r, dir) {
    var lastDeltaX = dir > 0 ? isDownList // right-side
    ? Number.MAX_VALUE // down
    : 0 // up
    : isDownList // left-side
    ? Number.MAX_VALUE // down
    : 0; // up

    for (var i = 0, l = list.length; i < l; i++) {
      var deltaY = Math.abs(list[i].y - cy);
      var length = list[i].len;
      var length2 = list[i].len2;
      var deltaX = deltaY < r + length ? Math.sqrt((r + length + length2) * (r + length + length2) - deltaY * deltaY) : Math.abs(list[i].x - cx);

      if (isDownList && deltaX >= lastDeltaX) {
        // right-down, left-down
        deltaX = lastDeltaX - 10;
      }

      if (!isDownList && deltaX <= lastDeltaX) {
        // right-up, left-up
        deltaX = lastDeltaX + 10;
      }

      list[i].x = cx + deltaX * dir;
      lastDeltaX = deltaX;
    }
  }

  var lastY = 0;
  var delta;
  var len = list.length;
  var upList = [];
  var downList = [];

  for (var i = 0; i < len; i++) {
    delta = list[i].y - lastY;

    if (delta < 0) {
      shiftDown(i, len, -delta, dir);
    }

    lastY = list[i].y + list[i].height;
  }

  if (viewHeight - lastY < 0) {
    shiftUp(len - 1, lastY - viewHeight);
  }

  for (var i = 0; i < len; i++) {
    if (list[i].y >= cy) {
      downList.push(list[i]);
    } else {
      upList.push(list[i]);
    }
  }

  changeX(upList, false, cx, cy, r, dir);
  changeX(downList, true, cx, cy, r, dir);
}

function avoidOverlap(labelLayoutList, cx, cy, r, viewWidth, viewHeight) {
  var leftList = [];
  var rightList = [];

  for (var i = 0; i < labelLayoutList.length; i++) {
    if (isPositionCenter(labelLayoutList[i])) {
      continue;
    }

    if (labelLayoutList[i].x < cx) {
      leftList.push(labelLayoutList[i]);
    } else {
      rightList.push(labelLayoutList[i]);
    }
  }

  adjustSingleSide(rightList, cx, cy, r, 1, viewWidth, viewHeight);
  adjustSingleSide(leftList, cx, cy, r, -1, viewWidth, viewHeight);

  for (var i = 0; i < labelLayoutList.length; i++) {
    if (isPositionCenter(labelLayoutList[i])) {
      continue;
    }

    var linePoints = labelLayoutList[i].linePoints;

    if (linePoints) {
      var dist = linePoints[1][0] - linePoints[2][0];

      if (labelLayoutList[i].x < cx) {
        linePoints[2][0] = labelLayoutList[i].x + 3;
      } else {
        linePoints[2][0] = labelLayoutList[i].x - 3;
      }

      linePoints[1][1] = linePoints[2][1] = labelLayoutList[i].y;
      linePoints[1][0] = linePoints[2][0] + dist;
    }
  }
}

function isPositionCenter(layout) {
  // Not change x for center label
  return layout.position === 'center';
}

export default function (seriesModel, r, viewWidth, viewHeight, sum) {
  var data = seriesModel.getData();
  var labelLayoutList = [];
  var cx;
  var cy;
  var hasLabelRotate = false;
  var minShowLabelRadian = (seriesModel.get('minShowLabelAngle') || 0) * RADIAN;
  data.each(function (idx) {
    var layout = data.getItemLayout(idx);
    var itemModel = data.getItemModel(idx);
    var labelModel = itemModel.getModel('label'); // Use position in normal or emphasis

    var labelPosition = labelModel.get('position') || itemModel.get('emphasis.label.position');
    var labelLineModel = itemModel.getModel('labelLine');
    var labelLineLen = labelLineModel.get('length');
    var labelLineLen2 = labelLineModel.get('length2');

    if (layout.angle < minShowLabelRadian) {
      return;
    }

    var midAngle = (layout.startAngle + layout.endAngle) / 2;
    var dx = Math.cos(midAngle);
    var dy = Math.sin(midAngle);
    var textX;
    var textY;
    var linePoints;
    var textAlign;
    cx = layout.cx;
    cy = layout.cy;
    var isLabelInside = labelPosition === 'inside' || labelPosition === 'inner';

    if (labelPosition === 'center') {
      textX = layout.cx;
      textY = layout.cy;
      textAlign = 'center';
    } else {
      var x1 = (isLabelInside ? (layout.r + layout.r0) / 2 * dx : layout.r * dx) + cx;
      var y1 = (isLabelInside ? (layout.r + layout.r0) / 2 * dy : layout.r * dy) + cy;
      textX = x1 + dx * 3;
      textY = y1 + dy * 3;

      if (!isLabelInside) {
        // For roseType
        var x2 = x1 + dx * (labelLineLen + r - layout.r);
        var y2 = y1 + dy * (labelLineLen + r - layout.r);
        var x3 = x2 + (dx < 0 ? -1 : 1) * labelLineLen2;
        var y3 = y2;
        textX = x3 + (dx < 0 ? -5 : 5);
        textY = y3;
        linePoints = [[x1, y1], [x2, y2], [x3, y3]];
      }

      textAlign = isLabelInside ? 'center' : dx > 0 ? 'left' : 'right';
    }

    var font = labelModel.getFont();
    var labelRotate;
    var rotate = labelModel.get('rotate');

    if (typeof rotate === 'number') {
      labelRotate = rotate * (Math.PI / 180);
    } else {
      labelRotate = rotate ? dx < 0 ? -midAngle + Math.PI : -midAngle : 0;
    }

    var text = seriesModel.getFormattedLabel(idx, 'normal') || data.getName(idx);
    var textRect = textContain.getBoundingRect(text, font, textAlign, 'top');
    hasLabelRotate = !!labelRotate;
    layout.label = {
      x: textX,
      y: textY,
      position: labelPosition,
      height: textRect.height,
      len: labelLineLen,
      len2: labelLineLen2,
      linePoints: linePoints,
      textAlign: textAlign,
      verticalAlign: 'middle',
      rotation: labelRotate,
      inside: isLabelInside
    }; // Not layout the inside label

    if (!isLabelInside) {
      labelLayoutList.push(layout.label);
    }
  });

  if (!hasLabelRotate && seriesModel.get('avoidLabelOverlap')) {
    avoidOverlap(labelLayoutList, cx, cy, r, viewWidth, viewHeight);
  }
}