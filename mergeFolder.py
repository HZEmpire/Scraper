import os
import shutil
from pathlib import Path

def move_files_to_final(list1, final, data_dir='data'):
    """
    将 list1 中每个文件夹下的所有文件移动到 data/{final} 文件夹中。
    如果移动后源文件夹为空，则删除该文件夹。

    :param list1: 要遍历的文件夹列表
    :param final: 目标文件夹名称
    :param data_dir: 数据目录，默认为 'data'
    """
    data_path = Path(data_dir)
    final_path = data_path / final

    # 检查并创建 data/{final} 文件夹
    if not final_path.exists():
        try:
            final_path.mkdir(parents=True, exist_ok=True)
            print(f"Created directory: {final_path}")
        except Exception as e:
            print(f"Error creating directory {final_path}: {e}")
            return
    else:
        print(f"Directory already exists: {final_path}")

    # 遍历 list1 中的每个文件夹
    for folder in list1:
        source_path = data_path / folder
        if source_path.exists() and source_path.is_dir():
            print(f"Processing folder: {source_path}")

            # 遍历 source_path 下的所有文件
            for item in source_path.iterdir():
                if item.is_file():
                    destination = final_path / item.name
                    try:
                        shutil.move(str(item), str(destination))
                        print(f"Moved file: {item} -> {destination}")
                    except Exception as e:
                        print(f"Error moving file {item} to {destination}: {e}")
                elif item.is_dir():
                    # 如果遇到子文件夹，可以选择递归移动，或跳过
                    # 这里选择递归移动子文件夹及其内容
                    try:
                        shutil.move(str(item), str(final_path / item.name))
                        print(f"Moved directory: {item} -> {final_path / item.name}")
                    except Exception as e:
                        print(f"Error moving directory {item} to {final_path / item.name}: {e}")

            # 检查 source_path 是否为空
            if not any(source_path.iterdir()):
                try:
                    source_path.rmdir()
                    print(f"Deleted empty directory: {source_path}")
                except Exception as e:
                    print(f"Error deleting directory {source_path}: {e}")
            else:
                print(f"Directory not empty, not deleted: {source_path}")
        else:
            print(f"Directory does not exist or is not a directory: {source_path}")

if __name__ == "__main__":
    # 定义 list1 和 final
    list1 = ["Collecting", "Pickup", "Shooting Video", "Burst", "Detonate"]
    final = "kneel"  # 可以修改为其他值，如 "d"

    move_files_to_final(list1, final)