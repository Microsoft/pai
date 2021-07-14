from pathlib import Path
import argparse
import json


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("host", default="localhost:30500", help="host addr of docker cache registry")
    return parser.parse_args()


def main():
    args = parse_args()

    folder_path = Path("/etc/docker")
    target_path = Path("/etc/docker/daemon.json")
    backup_path = Path("/etc/docker/daemon.json.bk")

    folder_path.mkdir(parents=True, exist_ok=True)
    if target_path.exists() and target_path.stat().st_size:
        backup_path.touch(mode=0o666)
        with open(str(target_path)) as f:
            current_config = json.load(f)
        with open(str(backup_path), 'w') as f:
            json.dump(current_config, f)
    else:
        target_path.touch(mode=0o666)
        current_config = {}

    docker_cache_mirror = "http://{}".format(args.host)
    if "registry-mirrors" in current_config:
        if docker_cache_mirror not in current_config["registry-mirrors"]:
            current_config["registry-mirrors"].append(docker_cache_mirror)
    else:
        current_config["registry-mirrors"] = [docker_cache_mirror]

    if "insecure-registries" in current_config:
        if docker_cache_mirror not in current_config["insecure-registries"]:
            current_config["insecure-registries"].append(docker_cache_mirror)
    else:
        current_config["insecure-registries"] = [docker_cache_mirror]

    with open(str(target_path), 'w') as f:
        json.dump(current_config, f)

if __name__ == "__main__":
    main()
