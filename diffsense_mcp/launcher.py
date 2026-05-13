#!/usr/bin/env python
"""
DiffSense MCP Server Launcher
用于 Cursor MCP 集成
"""
import sys
import os

# 设置路径 - 支持相对和绝对路径
if hasattr(os, 'getcwd'):
    # 获取launcher.py所在的目录
    launcher_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(launcher_dir)  # diffsense_mcp -> diffsense
else:
    project_root = r"C:\Users\30871\Desktop\diffsense-work-space\DiffSense"

sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, 'diffsense_mcp'))
os.chdir(project_root)

# 设置环境变量
os.environ['PYTHONPATH'] = project_root

# 启动 MCP Server
from diffsense_mcp.server import main

if __name__ == "__main__":
    main()
