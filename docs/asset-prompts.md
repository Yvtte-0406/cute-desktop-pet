# 当前动画素材

- assets/fox.png：已确认的白狐形象及托盘图标。
- assets/layers/body.png：原位置的身体层，保留头部和脸型。
- assets/layers/closed-reference.png：闭眼参考，只采样局部笑眼。
- assets/tails-overlap-v2/tail-01.png 至 tail-09.png：九条补画完整的尾巴。
- 同目录 layout.json / layout.js：坐标和尾根；occlusion.json / occlusion.js：遮挡与动态投影。

编号沿用用户标注，5号包括左耳后段，6号为右耳后遮挡尾。5在4前，1的尾根在2前。九条尾巴只作整体旋转，不拉伸或弯折；0.4.2将摆幅提高约60%。身体、脸型和尾尖素材未因摆幅调整而改变。

此前通过内置图像生成工具补齐隐藏部分，提示要求完整、纯白、蓬松、透明背景，避免碎片、孔洞、直切边和紫色毛边；随后按用户分界示意修订5号及遮挡关系。源图与修绘记录保留在当前素材目录 source/、prompt.txt、provenance.json。补画不是与原参考逐像素一致。当前没有调用模型计费API。

用户已确认当前拆分及动画。失效尾巴稿与旧动画预览已移入回收站。
