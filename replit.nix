{ pkgs }: {
  deps = [
    pkgs.nodejs
    pkgs.npm
  ];
  env = {
    LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [ pkgs.libuuid ];
  };
}
